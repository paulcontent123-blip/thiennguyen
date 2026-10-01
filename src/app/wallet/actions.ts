"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { buildVietQrUrl } from "@/lib/campaigns/content";
import { requireActionRole } from "@/lib/auth/server";
import { deliverDonationReceipt } from "@/lib/donations/receipt-delivery";
import { sendAdminPendingPaymentEmail, sendDonorPendingPaymentEmail } from "@/lib/email/notifications";
import { notifyAdmins, notifyUser } from "@/lib/notifications/create";
import { buildVnpayPaymentUrl, isVnpayConfigured } from "@/lib/payments/vnpay";
import { WALLET_MAX_TOPUP, WALLET_MIN_TOPUP, type WalletAllocationResult, type WalletTopupResult } from "@/lib/wallet/types";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function notifyPendingWalletTopup(input: {
  userId: string; txRef: string; amountVnd: number; userEmail: string | undefined; donorName: string | undefined;
  bankName: string; accountNo: string; accountName: string; transferDescription: string;
}) {
  const amountText = new Intl.NumberFormat("vi-VN").format(input.amountVnd);
  if (input.userEmail) {
    try {
      await sendDonorPendingPaymentEmail({
        to: input.userEmail, donorName: input.donorName, kind: "wallet_topup",
        txRef: input.txRef, amountVnd: input.amountVnd,
        bankName: input.bankName, accountNo: input.accountNo, accountName: input.accountName,
        transferDescription: input.transferDescription,
      });
    } catch (emailError) {
      console.error("Failed to notify donor of pending wallet top-up", { txRef: input.txRef, emailError });
    }
  }

  await notifyUser({
    userId: input.userId, category: "payment_pending",
    title: `Đã ghi nhận yêu cầu nạp ví ${amountText}đ`,
    body: `Mã ${input.txRef}. Chưa được Admin đối soát.`,
    link: "/wallet",
  });
  await notifyAdmins({
    category: "admin_alert",
    title: `Yêu cầu nạp ví mới chờ đối soát — ${amountText}đ`,
    body: `${input.txRef} · ${input.donorName || "Người dùng"} (${input.userEmail || "không rõ email"}).`,
    link: "/admin?panel=wallet",
  });

  const adminTo = process.env.ADMIN_PAYMENT_ALERT_EMAIL?.trim();
  if (!adminTo) return;
  try {
    await sendAdminPendingPaymentEmail({
      to: adminTo, kind: "wallet_topup", txRef: input.txRef, amountVnd: input.amountVnd,
      donorName: input.donorName ?? null, contactEmail: input.userEmail || "(không rõ email)",
      adminUrl: `${appUrl()}/admin?panel=wallet`,
    });
  } catch (emailError) {
    console.error("Failed to notify admin of pending wallet top-up", { txRef: input.txRef, emailError });
  }
}

export type WalletVnpayRedirectResult = { ok: true; redirectUrl: string } | { ok: false; message: string };

function clientIp() {
  const forwardedFor = headers().get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || headers().get("x-real-ip") || "127.0.0.1";
}

type TopupRow = {
  id: string;
  tx_ref: string;
  amount_vnd: number | string;
  bank_id: string;
  account_no: string;
  account_name: string;
  transfer_description: string;
};

function walletErrorMessage(message: string) {
  if (message.includes("WALLET_AMOUNT_INVALID")) return "Số tiền nạp phải từ 10.000đ đến 10 tỷ đồng.";
  if (message.includes("WALLET_TOO_MANY_PENDING")) return "Bạn đang có quá nhiều yêu cầu nạp chờ xác nhận (tối đa 5). Hãy chờ Admin đối soát.";
  if (message.includes("PLATFORM_RECEIVING_ACCOUNT_NOT_CONFIGURED")) return "Admin chưa cấu hình tài khoản nhận VND trung tâm.";
  if (message.includes("create_wallet_topup")) return "Database chưa được cập nhật migration ví.";
  return "Không thể tạo yêu cầu nạp ví lúc này. Vui lòng thử lại.";
}

export async function createWalletTopup(formData: FormData): Promise<WalletTopupResult> {
  const { supabase, user } = await requireActionRole(["donor", "org"]);
  const amount = Number(String(formData.get("amountVnd") ?? "").replace(/[^0-9]/g, ""));
  if (!Number.isSafeInteger(amount) || amount < WALLET_MIN_TOPUP || amount > WALLET_MAX_TOPUP) {
    return { ok: false, message: "Số tiền nạp phải từ 10.000đ đến 10 tỷ đồng." };
  }

  const { data, error } = await supabase.rpc("create_wallet_topup", { p_amount_vnd: amount });
  if (error) {
    console.error("Failed to create wallet top-up", { code: error.code, message: error.message });
    return { ok: false, message: walletErrorMessage(error.message) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as TopupRow | null;
  if (!row) return { ok: false, message: "Hệ thống không nhận được yêu cầu nạp vừa tạo." };

  const amountVnd = Number(row.amount_vnd);
  await notifyPendingWalletTopup({
    userId: user.id, txRef: row.tx_ref, amountVnd, userEmail: user.email, donorName: user.user_metadata?.full_name,
    bankName: row.bank_id, accountNo: row.account_no, accountName: row.account_name, transferDescription: row.transfer_description,
  });
  revalidatePath("/wallet");
  return {
    ok: true,
    message: "Đã tạo yêu cầu nạp ví. Số dư chỉ được cộng sau khi Admin đối soát khớp sao kê ngân hàng.",
    intent: {
      id: row.id,
      txRef: row.tx_ref,
      amountVnd,
      bankId: row.bank_id,
      accountNo: row.account_no,
      accountName: row.account_name,
      transferDescription: row.transfer_description,
      qrUrl: buildVietQrUrl(
        { bank_id: row.bank_id, account_no: row.account_no, account_name: row.account_name, description_template: row.transfer_description },
        { amount: amountVnd, campaignSlug: "", campaignId: "", txRef: row.tx_ref },
      ),
    },
  };
}

type AllocationRow = {
  transaction_id: string;
  tx_ref: string;
  balance_after_vnd: number | string;
  campaign_slug: string;
};

function allocationErrorMessage(message: string) {
  if (message.includes("WALLET_INSUFFICIENT_BALANCE")) return "Số dư ví không đủ để thực hiện phân bổ này.";
  if (message.includes("WALLET_ALLOCATION_AMOUNT_INVALID")) return "Số tiền phân bổ phải từ 10.000đ đến 10 tỷ đồng.";
  if (message.includes("CAMPAIGN_NOT_ACCEPTING_DONATIONS")) return "Chiến dịch không còn nhận ủng hộ hoặc chưa được công khai.";
  if (message.includes("WALLET_EMAIL_REQUIRED")) return "Tài khoản cần có email hợp lệ để nhận biên nhận.";
  if (message.includes("allocate_wallet_to_campaign")) return "Database chưa được cập nhật migration phân bổ ví.";
  return "Không thể phân bổ số dư lúc này. Vui lòng thử lại.";
}

export async function allocateWalletToCampaign(formData: FormData): Promise<WalletAllocationResult> {
  const { supabase } = await requireActionRole(["donor", "org"]);
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const amount = Number(String(formData.get("amountVnd") ?? "").replace(/[^0-9]/g, ""));
  if (!campaignId) return { ok: false, message: "Vui lòng chọn chiến dịch nhận phân bổ." };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return { ok: false, message: "Mã chống gửi trùng không hợp lệ. Hãy tải lại trang và thử lại." };
  }
  if (!Number.isSafeInteger(amount) || amount < WALLET_MIN_TOPUP || amount > WALLET_MAX_TOPUP) {
    return { ok: false, message: "Số tiền phân bổ phải từ 10.000đ đến 10 tỷ đồng." };
  }

  const { data, error } = await supabase.rpc("allocate_wallet_to_campaign", {
    p_campaign_id: campaignId,
    p_amount_vnd: amount,
    p_idempotency_key: requestId,
  });
  if (error) {
    console.error("Wallet allocation failed", { code: error.code, message: error.message });
    return { ok: false, message: allocationErrorMessage(error.message) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as AllocationRow | null;
  if (!row) return { ok: false, message: "Không nhận được kết quả phân bổ từ hệ thống." };

  const receipt = await deliverDonationReceipt(row.transaction_id);
  if (!receipt.ok) console.error("Wallet allocation receipt delivery failed", { txRef: row.tx_ref, message: receipt.message });
  revalidatePath("/wallet");
  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath(`/campaigns/${row.campaign_slug}`);
  return {
    ok: true,
    balanceAfterVnd: Number(row.balance_after_vnd),
    txRef: row.tx_ref,
    message: receipt.ok
      ? `Đã phân bổ thành công. Biên nhận PDF của giao dịch ${row.tx_ref} đã được gửi qua email.`
      : `Đã phân bổ thành công (${row.tx_ref}), nhưng email biên nhận đang chờ gửi lại.`,
  };
}

export async function createWalletTopupVnpay(formData: FormData): Promise<WalletVnpayRedirectResult> {
  if (!isVnpayConfigured()) {
    return { ok: false, message: "VNPAY chưa được cấu hình (thiếu VNPAY_TMN_CODE/VNPAY_HASH_SECRET). Hãy dùng chuyển khoản thủ công trong lúc chờ đăng ký merchant sandbox." };
  }
  const { supabase } = await requireActionRole(["donor", "org"]);
  const amount = Number(String(formData.get("amountVnd") ?? "").replace(/[^0-9]/g, ""));
  if (!Number.isSafeInteger(amount) || amount < WALLET_MIN_TOPUP || amount > WALLET_MAX_TOPUP) {
    return { ok: false, message: "Số tiền nạp phải từ 10.000đ đến 10 tỷ đồng." };
  }

  const { data, error } = await supabase.rpc("create_wallet_topup_vnpay", { p_amount_vnd: amount });
  if (error) {
    console.error("Failed to create VNPAY wallet top-up", { code: error.code, message: error.message });
    return { ok: false, message: walletErrorMessage(error.message) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { tx_ref: string; amount_vnd: number | string } | null;
  if (!row) return { ok: false, message: "Hệ thống không nhận được yêu cầu nạp vừa tạo." };

  const redirectUrl = buildVnpayPaymentUrl({
    txRef: row.tx_ref,
    amountVnd: Number(row.amount_vnd),
    orderInfo: `Nap vi - ${row.tx_ref}`,
    clientIp: clientIp(),
    purpose: "wallet_topup",
  });
  return { ok: true, redirectUrl };
}
