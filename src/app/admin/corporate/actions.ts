"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";

export type CorporateEsgActionResult = { ok: true; message: string } | { ok: false; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh(inquiryId: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/corporate/${inquiryId}/esg`);
}

export async function linkCorporateEsgCampaign(inquiryId: string, formData: FormData): Promise<CorporateEsgActionResult> {
  const { supabase, user } = await requireActionRole(["admin"]);
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const amountRaw = String(formData.get("committedAmountVnd") ?? "").replace(/[^0-9]/g, "");
  const note = String(formData.get("partnershipNote") ?? "").trim();
  const committedAmount = amountRaw ? Number(amountRaw) : null;

  if (!UUID_PATTERN.test(inquiryId) || !UUID_PATTERN.test(campaignId)) return { ok: false, message: "Mã hồ sơ hoặc chiến dịch không hợp lệ." };
  if (committedAmount !== null && (!Number.isSafeInteger(committedAmount) || committedAmount < 0 || committedAmount > 10_000_000_000_000)) {
    return { ok: false, message: "Giá trị cam kết không hợp lệ." };
  }
  if (note.length > 1000) return { ok: false, message: "Ghi chú tối đa 1.000 ký tự." };

  const [{ data: inquiry, error: inquiryError }, { data: campaign, error: campaignError }] = await Promise.all([
    supabase.from("corporate_inquiries").select("id").eq("id", inquiryId).maybeSingle(),
    supabase.from("campaigns").select("id, status").eq("id", campaignId).maybeSingle(),
  ]);
  if (inquiryError || !inquiry) return { ok: false, message: "Không tìm thấy hồ sơ doanh nghiệp." };
  if (campaignError || !campaign || !["approved", "active", "closed"].includes(campaign.status)) {
    return { ok: false, message: "Chỉ có thể liên kết chiến dịch đã duyệt, đang hoạt động hoặc đã đóng." };
  }

  const { error } = await supabase.from("corporate_esg_campaigns").upsert({
    inquiry_id: inquiryId,
    campaign_id: campaignId,
    committed_amount_vnd: committedAmount,
    partnership_note: note || null,
    linked_by: user.id,
  }, { onConflict: "inquiry_id,campaign_id" });

  if (error) {
    if (error.message.includes("corporate_esg_campaigns")) return { ok: false, message: "Database chưa áp dụng migration báo cáo ESG 202609250003." };
    return { ok: false, message: error.message };
  }
  refresh(inquiryId);
  return { ok: true, message: "Đã đưa chiến dịch vào phạm vi báo cáo ESG." };
}

export async function unlinkCorporateEsgCampaign(inquiryId: string, linkId: string): Promise<CorporateEsgActionResult> {
  const { supabase } = await requireActionRole(["admin"]);
  if (!UUID_PATTERN.test(inquiryId) || !UUID_PATTERN.test(linkId)) return { ok: false, message: "Mã liên kết không hợp lệ." };

  const { data, error } = await supabase
    .from("corporate_esg_campaigns")
    .delete()
    .eq("id", linkId)
    .eq("inquiry_id", inquiryId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Không tìm thấy liên kết cần xóa." };
  refresh(inquiryId);
  return { ok: true, message: "Đã loại chiến dịch khỏi báo cáo ESG." };
}
