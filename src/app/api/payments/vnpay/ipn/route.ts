import { NextRequest, NextResponse } from "next/server";
import { deliverDonationReceipt } from "@/lib/donations/receipt-delivery";
import { sendWalletTopupCompletedEmail } from "@/lib/email/notifications";
import { notifyUser } from "@/lib/notifications/create";
import { verifyVnpaySignature, type VnpayCallbackParams } from "@/lib/payments/vnpay";
import { createAdminClient } from "@/lib/supabase/admin";

// Endpoint IPN (Instant Payment Notification) của VNPAY: cổng gọi thẳng server-to-server bằng GET
// sau khi người dùng thanh toán xong. Đây là nguồn sự thật duy nhất để ghi nhận thành công —
// Return URL (trình duyệt người dùng) chỉ dùng để hiển thị, không được dùng để ghi nhận giao dịch.
// Tham chiếu format phản hồi: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html#ipn-url

function reply(code: string, message: string) {
  return NextResponse.json({ RspCode: code, Message: message });
}

export async function GET(request: NextRequest) {
  const params: VnpayCallbackParams = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  if (!verifyVnpaySignature(params)) {
    console.error("VNPAY IPN: invalid signature", { txnRef: params.vnp_TxnRef });
    return reply("97", "Invalid signature");
  }

  const txRef = params.vnp_TxnRef;
  const responseCode = params.vnp_ResponseCode ?? params.vnp_TransactionStatus ?? "99";
  const bankCode = params.vnp_BankCode ?? "";
  const gatewayTxnRef = params.vnp_TransactionNo || params.vnp_TxnRef;
  const amountVnd = Number(params.vnp_Amount ?? "0") / 100;
  if (!txRef || !Number.isFinite(amountVnd) || amountVnd <= 0) {
    return reply("99", "Missing or invalid parameters");
  }

  const admin = createAdminClient();
  const isWalletTopup = txRef.startsWith("VIVNP");
  const isDonation = txRef.startsWith("TNVNP");
  if (!isWalletTopup && !isDonation) {
    return reply("01", "Order not found");
  }

  try {
    const { data, error } = await admin.rpc(
      isDonation ? "complete_donation_via_vnpay" : "complete_wallet_topup_via_vnpay",
      {
        p_tx_ref: txRef,
        p_gateway_txn_ref: gatewayTxnRef,
        p_response_code: responseCode,
        p_bank_code: bankCode,
        p_amount_vnd: amountVnd,
        p_raw: params,
      },
    );
    if (error) {
      if (error.message.includes("NOT_FOUND")) return reply("01", "Order not found");
      if (error.message.includes("AMOUNT_MISMATCH")) return reply("04", "Invalid amount");
      console.error("VNPAY IPN: RPC failed", { txRef, message: error.message });
      return reply("99", "Unknown error");
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.already_processed) return reply("02", "Order already confirmed");

    // Chỉ gửi thông báo khi đây là lần xử lý đầu tiên và thực sự thành công (status completed),
    // tránh gửi email trùng khi VNPAY gọi lại IPN (họ có thể gửi lại nếu không nhận được phản hồi 00).
    // Phải await trước khi trả response — môi trường serverless (Vercel) có thể đóng tiến trình
    // ngay sau khi response được gửi đi, nên "fire-and-forget" ở đây sẽ không chạy hết việc.
    if (row?.status === "completed") {
      try {
        const amountText = new Intl.NumberFormat("vi-VN").format(amountVnd);
        if (isDonation) {
          await deliverDonationReceipt(row.id);
          const { data: tx } = await admin.from("transactions").select("user_id").eq("id", row.id).maybeSingle();
          if (tx?.user_id) {
            await notifyUser({
              userId: tx.user_id, category: "payment_completed",
              title: `Đã nhận ${amountText}đ qua VNPAY`,
              body: `Giao dịch ${txRef} đã được VNPAY xác nhận tự động.`,
              link: "/account",
            });
          }
        } else {
          const { data: topup } = await admin.from("wallet_topups").select("user_id").eq("id", row.id).maybeSingle();
          if (topup) {
            const { data: authUser } = await admin.auth.admin.getUserById(topup.user_id);
            if (authUser.user?.email) {
              await sendWalletTopupCompletedEmail({
                to: authUser.user.email, donorName: authUser.user.user_metadata?.full_name ?? null,
                txRef, amountVnd, viaGateway: true,
              });
            }
            await notifyUser({
              userId: topup.user_id, category: "payment_completed",
              title: `Đã cộng ${amountText}đ vào ví qua VNPAY`,
              body: `Yêu cầu nạp ví ${txRef} đã được VNPAY xác nhận tự động.`,
              link: "/wallet",
            });
          }
        }
      } catch (notifyError) {
        // Email/biên nhận gửi lỗi không được làm hỏng việc xác nhận giao dịch với VNPAY —
        // giao dịch đã completed trong database rồi, chỉ ghi log để retry thủ công sau.
        console.error("VNPAY IPN: failed to notify after completion", { txRef, isDonation, notifyError });
      }
    }

    return reply("00", "Confirm Success");
  } catch (caughtError) {
    console.error("VNPAY IPN: unexpected error", { txRef, caughtError });
    return reply("99", "Unknown error");
  }
}
