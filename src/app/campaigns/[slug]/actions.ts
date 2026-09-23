"use server";

import { buildVietQrUrl } from "@/lib/campaigns/content";
import {
  DONATION_MAX_AMOUNT,
  DONATION_MIN_AMOUNT,
  type DonationActionResult,
} from "@/lib/donations/types";
import { createClient } from "@/lib/supabase/server";

type DonationIntentRow = {
  id: string;
  tx_ref: string;
  amount_vnd: number | string;
  status: string;
  bank_id: string;
  account_no: string;
  account_name: string;
  transfer_description: string;
  expires_at: string;
  created_at: string;
};

function donationErrorMessage(message: string) {
  if (message.includes("DONATION_AMOUNT_INVALID")) return "Số tiền ủng hộ phải từ 10.000đ đến 10 tỷ đồng.";
  if (message.includes("DONATION_EMAIL_INVALID")) return "Email nhận biên nhận không hợp lệ.";
  if (message.includes("DONATION_NAME_INVALID")) return "Tên người ủng hộ phải từ 2 đến 120 ký tự.";
  if (message.includes("CAMPAIGN_NOT_ACCEPTING_DONATIONS")) return "Chiến dịch hiện không mở nhận ủng hộ.";
  if (message.includes("PLATFORM_RECEIVING_ACCOUNT_NOT_CONFIGURED")) return "Admin chưa cấu hình tài khoản nhận VND trung tâm.";
  if (message.includes("create_donation_intent")) return "Database chưa được cập nhật migration tạo giao dịch quyên góp.";
  return "Không thể tạo giao dịch ủng hộ lúc này. Vui lòng thử lại.";
}

export async function createDonationIntent(formData: FormData): Promise<DonationActionResult> {
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const campaignSlug = String(formData.get("campaignSlug") ?? "").trim();
  const receiptEmail = String(formData.get("receiptEmail") ?? "").trim().toLowerCase();
  const donorName = String(formData.get("donorName") ?? "").trim();
  const amount = Number(String(formData.get("amountVnd") ?? "").replace(/[^0-9]/g, ""));

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) {
    return { ok: false, message: "Mã chiến dịch không hợp lệ." };
  }
  if (!campaignSlug || campaignSlug.length > 180) {
    return { ok: false, message: "Đường dẫn chiến dịch không hợp lệ." };
  }
  if (!Number.isSafeInteger(amount) || amount < DONATION_MIN_AMOUNT || amount > DONATION_MAX_AMOUNT) {
    return { ok: false, message: "Số tiền ủng hộ phải từ 10.000đ đến 10 tỷ đồng." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail) || receiptEmail.length > 254) {
    return { ok: false, message: "Email nhận biên nhận không hợp lệ." };
  }
  if (donorName && (donorName.length < 2 || donorName.length > 120)) {
    return { ok: false, message: "Tên người ủng hộ phải từ 2 đến 120 ký tự." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_donation_intent", {
    p_campaign_id: campaignId,
    p_amount_vnd: amount,
    p_receipt_email: receiptEmail,
    p_donor_name: donorName || null,
  });

  if (error) {
    console.error("Failed to create donation intent", { code: error.code, message: error.message });
    return { ok: false, message: donationErrorMessage(error.message) };
  }

  const row = (Array.isArray(data) ? data[0] : data) as DonationIntentRow | null;
  const amountVnd = Number(row?.amount_vnd ?? 0);
  if (!row || !Number.isFinite(amountVnd) || row.status !== "pending") {
    return { ok: false, message: "Hệ thống không nhận được dữ liệu giao dịch vừa tạo." };
  }

  const qrUrl = buildVietQrUrl(
    {
      bank_id: row.bank_id,
      account_no: row.account_no,
      account_name: row.account_name,
      description_template: row.transfer_description,
    },
    {
      amount: amountVnd,
      campaignSlug,
      campaignId,
      txRef: row.tx_ref,
    },
  );

  return {
    ok: true,
    message: "Đã tạo mã chuyển khoản. Giao dịch sẽ ở trạng thái chờ cho đến khi ngân hàng xác nhận.",
    intent: {
      id: row.id,
      txRef: row.tx_ref,
      amountVnd,
      status: "pending",
      bankId: row.bank_id,
      accountNo: row.account_no,
      accountName: row.account_name,
      transferDescription: row.transfer_description,
      qrUrl,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    },
  };
}
