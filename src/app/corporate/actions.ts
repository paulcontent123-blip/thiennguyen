"use server";

import { randomUUID } from "node:crypto";
import { BUDGET_RANGES, INQUIRY_INTERESTS, budgetLabel, interestLabel } from "@/lib/corporate/options";
import { sendCorporateInquiryNotification } from "@/lib/email/notifications";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type CorporateInquiryResult = { ok: true; message: string } | { ok: false; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function submitCorporateInquiry(formData: FormData): Promise<CorporateInquiryResult> {
  if (!hasSupabaseEnv()) return { ok: false, message: "Hệ thống chưa được cấu hình." };

  // Trường ẩn để chặn bot điền tự động.
  if (String(formData.get("website") ?? "").trim()) return { ok: true, message: "Đã gửi yêu cầu." };

  const companyName = String(formData.get("companyName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const budgetRange = String(formData.get("budgetRange") ?? "");
  const focusArea = String(formData.get("focusArea") ?? "").trim();
  const interest = String(formData.get("interest") ?? "other");
  const campaignIdRaw = String(formData.get("campaignId") ?? "").trim();

  if (companyName.length < 2 || companyName.length > 200) return { ok: false, message: "Tên doanh nghiệp chưa hợp lệ." };
  if (contactName.length < 2 || contactName.length > 120) return { ok: false, message: "Họ tên người liên hệ chưa hợp lệ." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || contactEmail.length > 254) return { ok: false, message: "Email không hợp lệ." };
  if (!BUDGET_RANGES.some((item) => item.value === budgetRange)) return { ok: false, message: "Vui lòng chọn ngân sách CSR dự kiến." };
  if (focusArea.length > 300) return { ok: false, message: "Lĩnh vực ưu tiên tối đa 300 ký tự." };
  if (!INQUIRY_INTERESTS.some((item) => item.value === interest)) return { ok: false, message: "Hình thức quan tâm không hợp lệ." };
  if (campaignIdRaw && !UUID_PATTERN.test(campaignIdRaw)) return { ok: false, message: "Chiến dịch không hợp lệ." };

  const supabase = createClient();
  const id = randomUUID();
  const { error } = await supabase.from("corporate_inquiries").insert({
    id,
    company_name: companyName,
    contact_name: contactName,
    contact_email: contactEmail,
    budget_range: budgetRange,
    focus_area: focusArea || null,
    interest,
    campaign_id: campaignIdRaw || null,
  });
  if (error) return { ok: false, message: "Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau." };

  const notifyTo = process.env.CORPORATE_INQUIRY_TO_EMAIL?.trim();
  if (notifyTo) {
    try {
      let campaignTitle: string | null = null;
      if (campaignIdRaw) {
        const { data } = await supabase.from("campaigns").select("title").eq("id", campaignIdRaw).maybeSingle();
        campaignTitle = data?.title ?? null;
      }
      await sendCorporateInquiryNotification({
        to: notifyTo,
        inquiryId: id,
        companyName,
        contactName,
        contactEmail,
        budgetLabel: budgetLabel(budgetRange),
        focusArea: focusArea || null,
        interestLabel: interestLabel(interest),
        campaignTitle,
      });
    } catch (emailError) {
      console.error("Corporate inquiry notification failed", { id, emailError });
    }
  }

  return { ok: true, message: "Đã gửi yêu cầu! Đội ngũ sẽ liên hệ với bạn qua email sớm nhất có thể." };
}
