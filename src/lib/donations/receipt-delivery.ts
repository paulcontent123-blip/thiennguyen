import "server-only";

import { sendDonationReceiptEmail } from "@/lib/email/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDonationReceiptPdf, sha256Hex } from "./receipt-pdf";

type CampaignRelation = {
  title: string;
  owner_type: string;
  organizations: { name: string } | { name: string }[] | null;
};

export type ReceiptDeliveryResult =
  | { ok: true; hash: string; providerId: string | null }
  | { ok: false; message: string };

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function deliverDonationReceipt(transactionId: string): Promise<ReceiptDeliveryResult> {
  const admin = createAdminClient();
  const { data: transaction, error } = await admin
    .from("transactions")
    .select("id, tx_ref, status, amount_vnd, received_amount, donor_name, receipt_email, completed_at, payment_provider, receipt_email_status, receipt_email_attempts, campaigns(title, owner_type, organizations(name))")
    .eq("id", transactionId)
    .maybeSingle();

  if (error || !transaction) return { ok: false, message: error?.message || "Không tìm thấy giao dịch." };
  if (transaction.status !== "completed") return { ok: false, message: "Chỉ phát hành biên nhận cho giao dịch thành công." };
  if (transaction.receipt_email_status === "sent") {
    return { ok: true, hash: "", providerId: null };
  }

  // Ghi trạng thái "đang gửi"/"đã gửi"/"gửi lỗi" qua RPC riêng (chạy bằng service role) thay vì
  // update trực tiếp — update thẳng sẽ bị guard_transaction_reconciliation_fields chặn vì service
  // role không phải phiên Admin cũng không phải IPN VNPAY.
  const attempt = Number(transaction.receipt_email_attempts || 0) + 1;
  const { data: claimedRows, error: claimError } = await admin.rpc("claim_receipt_delivery", { p_transaction_id: transaction.id });
  if (claimError) return { ok: false, message: claimError.message };
  const claimed = Array.isArray(claimedRows) ? claimedRows[0] : claimedRows;
  if (!claimed) return { ok: false, message: "Biên nhận đang được một tiến trình khác xử lý." };

  const campaign = relation(transaction.campaigns as CampaignRelation | CampaignRelation[] | null);
  const organization = relation(campaign?.organizations);
  const completedAt = transaction.completed_at || new Date().toISOString();
  const amount = Number(transaction.received_amount ?? transaction.amount_vnd) || 0;
  const pdf = generateDonationReceiptPdf({
    txRef: transaction.tx_ref,
    donorName: transaction.donor_name,
    receiptEmail: transaction.receipt_email,
    campaignTitle: campaign?.title || "Chiến dịch thiện nguyện",
    ownerName: campaign?.owner_type === "individual" ? "Chủ chiến dịch cá nhân đã xác minh" : organization?.name || "Tổ chức thiện nguyện",
    amountVnd: amount,
    completedAt,
    paymentMethod: transaction.payment_provider === "wallet" ? "Phân bổ từ ví Thiện Nguyện" : "Chuyển khoản ngân hàng",
  });
  const hash = sha256Hex(pdf);

  try {
    const sent = await sendDonationReceiptEmail({
      to: transaction.receipt_email,
      donorName: transaction.donor_name ?? undefined,
      donationId: transaction.id,
      txRef: transaction.tx_ref,
      campaignTitle: campaign?.title || "Chiến dịch thiện nguyện",
      amount,
      pdf,
      sha256: hash,
      filename: `bien-nhan-${transaction.tx_ref}.pdf`,
    });
    const { error: updateError } = await admin.rpc("finalize_receipt_delivery", {
      p_transaction_id: transaction.id,
      p_success: true,
      p_hash: hash,
      p_provider_id: sent.id,
      p_error_message: null,
      p_retry_delay_minutes: null,
    });
    if (updateError) throw updateError;
    return { ok: true, hash, providerId: sent.id };
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : "Không gửi được email biên nhận.";
    const delayMinutes = Math.min(60, 2 ** Math.min(attempt, 5));
    const { error: finalizeError } = await admin.rpc("finalize_receipt_delivery", {
      p_transaction_id: transaction.id,
      p_success: false,
      p_hash: hash,
      p_provider_id: null,
      p_error_message: message,
      p_retry_delay_minutes: delayMinutes,
    });
    if (finalizeError) console.error("Failed to record receipt delivery failure", { txRef: transaction.tx_ref, finalizeError });
    return { ok: false, message };
  }
}
