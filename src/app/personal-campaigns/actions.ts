"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/categories";
import { PROVINCES } from "@/lib/geo/provinces";
import { slugify } from "@/lib/utils/slugify";

export type PersonalCampaignActionResult = { ok: true; message: string } | { ok: false; message: string };

const VERIFICATION_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_VERIFICATION_SIZE = 10 * 1024 * 1024;

async function requireDonor() {
  return requireActionRole(["donor"]);
}

function getFile(formData: FormData, field: string) {
  const value = formData.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

type ValidatedCampaign =
  | { error: string }
  | { value: { title: string; description: string; category: string; province: string; campaignType: string; deadline: string; targetAmount: number } };

function validateCampaign(formData: FormData): ValidatedCampaign {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const province = String(formData.get("province") ?? "");
  const campaignType = String(formData.get("campaignType") ?? "");
  const deadline = String(formData.get("deadline") ?? "");
  const targetAmount = Number(formData.get("targetAmount") ?? 0);

  if (title.length < 5 || title.length > 180 || description.length > 5000 || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { error: "Thông tin chiến dịch chưa hợp lệ." };
  }
  if (!CAMPAIGN_CATEGORIES.includes(category as (typeof CAMPAIGN_CATEGORIES)[number])) {
    return { error: "Hạng mục chiến dịch không hợp lệ." };
  }
  if (!PROVINCES.includes(province as (typeof PROVINCES)[number])) {
    return { error: "Tỉnh/thành không hợp lệ." };
  }
  if (!["direct", "partner"].includes(campaignType)) {
    return { error: "Loại chiến dịch không hợp lệ." };
  }

  return { value: { title, description, category, province, campaignType, deadline, targetAmount } };
}

export async function submitPersonalVerification(formData: FormData): Promise<PersonalCampaignActionResult> {
  const { supabase, user } = await requireDonor();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const document = getFile(formData, "verificationDocument");

  if (legalName.length < 2 || legalName.length > 160) {
    return { ok: false, message: "Họ tên người sở hữu phải từ 2 đến 160 ký tự." };
  }
  if (phone && (phone.length < 8 || phone.length > 30)) {
    return { ok: false, message: "Số điện thoại không hợp lệ." };
  }
  if (!document) {
    return { ok: false, message: "Vui lòng tải lên giấy tờ xác minh cá nhân." };
  }
  if (!VERIFICATION_TYPES.includes(document.type) || document.size > MAX_VERIFICATION_SIZE) {
    return { ok: false, message: "Giấy tờ phải là PDF, JPG, PNG hoặc WebP và không vượt quá 10 MB." };
  }

  const extension = document.type === "application/pdf" ? "pdf" : document.type.split("/")[1] || "bin";
  const documentPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("personal-verification").upload(documentPath, document, {
    contentType: document.type,
    upsert: false,
  });
  if (uploadError) return { ok: false, message: `Không thể lưu giấy tờ xác minh: ${uploadError.message}` };

  const { data: existingProfile } = await supabase
    .from("personal_profiles")
    .select("verification_document_path")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("personal_profiles").upsert(
    {
      user_id: user.id,
      legal_name: legalName,
      phone: phone || null,
      verification_status: "pending",
      verification_document_path: documentPath,
      verification_note: null,
      verified_at: null,
      verified_by: null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    await supabase.storage.from("personal-verification").remove([documentPath]).catch(() => undefined);
    return { ok: false, message: error.message };
  }

  if (existingProfile?.verification_document_path && existingProfile.verification_document_path !== documentPath) {
    await supabase.storage.from("personal-verification").remove([existingProfile.verification_document_path]).catch(() => undefined);
  }

  revalidatePath("/personal-campaigns");
  revalidatePath("/admin");
  return { ok: true, message: "Đã gửi hồ sơ cá nhân. Admin sẽ kiểm tra trước khi bạn tạo chiến dịch." };
}

export async function createPersonalCampaign(formData: FormData): Promise<PersonalCampaignActionResult> {
  const { supabase, user } = await requireDonor();
  const { data: profile, error: profileError } = await supabase
    .from("personal_profiles")
    .select("verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) return { ok: false, message: profileError.message };
  if (profile?.verification_status !== "approved") {
    return { ok: false, message: "Bạn cần được xác minh hồ sơ cá nhân trước khi tạo chiến dịch." };
  }

  const validated = validateCampaign(formData);
  if ("error" in validated) return { ok: false, message: validated.error };
  const { title, description, category, province, campaignType, deadline, targetAmount } = validated.value;

  const { error } = await supabase.from("campaigns").insert({
    owner_type: "individual",
    owner_user_id: user.id,
    organization_id: null,
    title,
    slug: slugify(title),
    summary: description.slice(0, 300),
    description,
    target_amount: targetAmount,
    campaign_type: campaignType,
    category,
    province,
    deadline: deadline || null,
    status: "draft",
  });

  if (error) return { ok: false, message: error.message };
  revalidatePath("/personal-campaigns");
  revalidatePath("/");
  return { ok: true, message: "Đã tạo bản nháp chiến dịch cá nhân." };
}

export async function updatePersonalCampaign(id: string, formData: FormData): Promise<PersonalCampaignActionResult> {
  const { supabase, user } = await requireDonor();
  const validated = validateCampaign(formData);
  if ("error" in validated) return { ok: false, message: validated.error };
  const { title, description, category, province, campaignType, deadline, targetAmount } = validated.value;

  const { data, error } = await supabase
    .from("campaigns")
    .update({
      title,
      slug: slugify(title),
      summary: description.slice(0, 300),
      description,
      target_amount: targetAmount,
      campaign_type: campaignType,
      category,
      province,
      deadline: deadline || null,
    })
    .eq("id", id)
    .eq("owner_type", "individual")
    .eq("owner_user_id", user.id)
    .in("status", ["draft", "needs_revision"])
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Chỉ có thể sửa chiến dịch nháp hoặc đang cần bổ sung." };
  revalidatePath("/personal-campaigns");
  return { ok: true, message: "Đã cập nhật nội dung chiến dịch." };
}

export async function submitPersonalCampaignForReview(id: string): Promise<PersonalCampaignActionResult> {
  const { supabase, user } = await requireDonor();
  const { data, error } = await supabase
    .from("campaigns")
    .update({ status: "pending_review", submitted_at: new Date().toISOString(), review_note: null })
    .eq("id", id)
    .eq("owner_type", "individual")
    .eq("owner_user_id", user.id)
    .in("status", ["draft", "needs_revision"])
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Chiến dịch không tồn tại hoặc không thể gửi duyệt ở trạng thái hiện tại." };
  revalidatePath("/personal-campaigns");
  revalidatePath("/admin");
  return { ok: true, message: "Đã gửi chiến dịch cho Admin xét duyệt." };
}
