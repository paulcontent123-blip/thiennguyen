"use server";

import { revalidatePath } from "next/cache";
import { buildVietQrUrl } from "@/lib/campaigns/content";
import { requireActionRole } from "@/lib/auth/server";
import { deliverDonationReceipt } from "@/lib/donations/receipt-delivery";
import { WALLET_MAX_TOPUP, WALLET_MIN_TOPUP, type WalletAllocationResult, type WalletTopupResult } from "@/lib/wallet/types";

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
  const { supabase } = await requireActionRole(["donor", "org"]);
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
