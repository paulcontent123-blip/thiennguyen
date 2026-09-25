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

  const attempt = Number(transaction.receipt_email_attempts || 0) + 1;
  const { data: claimed, error: claimError } = await admin
    .from("transactions")
    .update({
      receipt_email_status: "sending",
      receipt_email_attempts: attempt,
      receipt_email_last_error: null,
      receipt_next_retry_at: null,
    })
    .eq("id", transaction.id)
    .in("receipt_email_status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (claimError) return { ok: false, message: claimError.message };
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
    const { error: updateError } = await admin.from("transactions").update({
      receipt_pdf_hash: hash,
      receipt_generated_at: completedAt,
      receipt_email_status: "sent",
      receipt_sent_at: new Date().toISOString(),
      receipt_provider_id: sent.id,
      receipt_email_last_error: null,
      receipt_next_retry_at: null,
    }).eq("id", transaction.id);
    if (updateError) throw updateError;
    return { ok: true, hash, providerId: sent.id };
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : "Không gửi được email biên nhận.";
    const delayMinutes = Math.min(60, 2 ** Math.min(attempt, 5));
    await admin.from("transactions").update({
      receipt_pdf_hash: hash,
      receipt_generated_at: completedAt,
      receipt_email_status: "failed",
      receipt_email_last_error: message.slice(0, 1000),
      receipt_next_retry_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    }).eq("id", transaction.id);
    return { ok: false, message };
  }
}
