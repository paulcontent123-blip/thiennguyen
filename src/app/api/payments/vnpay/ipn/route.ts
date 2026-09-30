import { NextRequest, NextResponse } from "next/server";
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
    return reply("00", "Confirm Success");
  } catch (caughtError) {
    console.error("VNPAY IPN: unexpected error", { txRef, caughtError });
    return reply("99", "Unknown error");
  }
}
