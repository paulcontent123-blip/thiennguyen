"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { destroyCloudinaryAsset, uploadToCloudinary } from "@/lib/cloudinary/server";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/categories";
import { slugify } from "@/lib/utils/slugify";

export type OrganizationActionResult = { ok: true; message: string } | { ok: false; message: string };

const LICENSE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_LICENSE_SIZE = 10 * 1024 * 1024;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

async function requireOrganization() {
  const { supabase, user } = await requireActionRole(["org"]);
  const { data: organization, error } = await supabase
    .from("organizations")
    .select("id, name, legal_representative_name, legal_representative_email, legal_representative_phone, license_status, license_public_id, avatar_public_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !organization) throw new Error("Không tìm thấy hồ sơ tổ chức.");
  return { supabase, user, organization };
}

function getFile(formData: FormData, field: string) {
  const value = formData.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function updateOrganizationProfile(formData: FormData): Promise<OrganizationActionResult> {
  const { supabase, organization } = await requireOrganization();
  const name = String(formData.get("name") ?? "").trim();
  const representativeName = String(formData.get("representativeName") ?? "").trim();
  const representativeEmail = String(formData.get("representativeEmail") ?? "").trim();
  const representativePhone = String(formData.get("representativePhone") ?? "").trim();

  if (name.length < 2 || name.length > 160 || representativeName.length < 2 || representativeName.length > 100) {
    return { ok: false, message: "Tên tổ chức và người đại diện chưa hợp lệ." };
  }
  if (representativeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(representativeEmail)) {
    return { ok: false, message: "Email người đại diện không hợp lệ." };
  }
  if (representativePhone.length > 20) return { ok: false, message: "Số điện thoại quá dài." };

  const legalProfileChanged =
    name !== organization.name
    || representativeName !== organization.legal_representative_name
    || (representativeEmail || null) !== organization.legal_representative_email
    || (representativePhone || null) !== organization.legal_representative_phone;
  const requiresReverification = organization.license_status === "approved" && legalProfileChanged;

  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      legal_representative_name: representativeName,
      legal_representative_email: representativeEmail || null,
      legal_representative_phone: representativePhone || null,
      ...(requiresReverification
        ? { license_status: "pending", license_note: null, verified_at: null, verified_by: null }
        : {}),
    })
    .eq("id", organization.id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/organization");
  return {
    ok: true,
    message: requiresReverification
      ? "Đã cập nhật hồ sơ. Do thông tin pháp lý thay đổi, tổ chức được chuyển về trạng thái chờ duyệt."
      : "Đã cập nhật thông tin tổ chức.",
  };
}

export async function uploadOrganizationAvatar(formData: FormData): Promise<OrganizationActionResult> {
  const file = getFile(formData, "avatar");
  if (!file) return { ok: false, message: "Vui lòng chọn ảnh đại diện." };
  if (!AVATAR_TYPES.includes(file.type) || file.size > MAX_AVATAR_SIZE) {
    return { ok: false, message: "Ảnh đại diện phải là JPG, PNG hoặc WebP và không vượt quá 5 MB." };
  }

  const { supabase, organization } = await requireOrganization();
  let uploaded: Awaited<ReturnType<typeof uploadToCloudinary>>;
  try {
    uploaded = await uploadToCloudinary(file, "thiennguyen/avatars", `${organization.id}-avatar-${Date.now()}`);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Upload ảnh thất bại." };
  }

  const { error } = await supabase
    .from("organizations")
    .update({ avatar_url: uploaded.secureUrl, avatar_public_id: uploaded.publicId })
    .eq("id", organization.id);
  if (error) {
    await destroyCloudinaryAsset(uploaded.publicId).catch(() => undefined);
    return { ok: false, message: error.message };
  }

  await destroyCloudinaryAsset(organization.avatar_public_id).catch(() => undefined);
  revalidatePath("/organization");
  return { ok: true, message: "Đã cập nhật ảnh đại diện." };
}

export async function uploadOrganizationLicense(formData: FormData): Promise<OrganizationActionResult> {
  const file = getFile(formData, "license");
  const licenseNumber = String(formData.get("licenseNumber") ?? "").trim();
  if (!file) return { ok: false, message: "Vui lòng chọn tệp giấy phép." };
  if (!LICENSE_TYPES.includes(file.type) || file.size > MAX_LICENSE_SIZE) {
    return { ok: false, message: "Giấy phép phải là PDF, JPG, PNG hoặc WebP và không vượt quá 10 MB." };
  }
  if (!licenseNumber || licenseNumber.length > 100) {
    return { ok: false, message: "Vui lòng nhập số giấy phép hợp lệ." };
  }

  const { supabase, organization } = await requireOrganization();
  let uploaded: Awaited<ReturnType<typeof uploadToCloudinary>>;
  try {
    uploaded = await uploadToCloudinary(file, "thiennguyen/licenses", `${organization.id}-license-${Date.now()}`);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Upload giấy phép thất bại." };
  }

  const { error } = await supabase.rpc("submit_organization_license", {
    p_license_url: uploaded.secureUrl,
    p_license_public_id: uploaded.publicId,
    p_license_number: licenseNumber,
  });
  if (error) {
    await destroyCloudinaryAsset(uploaded.publicId).catch(() => undefined);
    return { ok: false, message: error.message };
  }

  await destroyCloudinaryAsset(organization.license_public_id).catch(() => undefined);
  revalidatePath("/organization");
  revalidatePath("/admin");
  return { ok: true, message: "Đã gửi giấy phép. Hồ sơ được chuyển về trạng thái chờ duyệt." };
}

export async function createOrganizationCampaign(formData: FormData): Promise<OrganizationActionResult> {
  const { supabase, organization } = await requireOrganization();
  if (organization.license_status !== "approved") {
    return { ok: false, message: "Tổ chức phải được duyệt giấy phép trước khi tạo chiến dịch." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const campaignType = String(formData.get("campaignType") ?? "");
  const deadline = String(formData.get("deadline") ?? "");
  const targetAmount = Number(formData.get("targetAmount") ?? 0);

  if (title.length < 5 || title.length > 180 || description.length > 5000 || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { ok: false, message: "Thông tin chiến dịch chưa hợp lệ." };
  }
  if (!CAMPAIGN_CATEGORIES.includes(category as (typeof CAMPAIGN_CATEGORIES)[number])) {
    return { ok: false, message: "Hạng mục chiến dịch không hợp lệ." };
  }
  if (!['direct', 'partner'].includes(campaignType)) return { ok: false, message: "Loại chiến dịch không hợp lệ." };

  const slug = slugify(title);
  const { error } = await supabase.from("campaigns").insert({
    organization_id: organization.id,
    title,
    slug,
    summary: description.slice(0, 300),
    description,
    target_amount: targetAmount,
    campaign_type: campaignType,
    category,
    deadline: deadline || null,
    status: "draft",
  });

  if (error) return { ok: false, message: error.message };
  revalidatePath("/organization");
  return { ok: true, message: "Đã tạo bản nháp chiến dịch." };
}

export async function submitCampaignForReview(id: string): Promise<OrganizationActionResult> {
  const { supabase, organization } = await requireOrganization();
  if (organization.license_status !== "approved") {
    return { ok: false, message: "Giấy phép tổ chức chưa được duyệt." };
  }

  const { data: updatedCampaign, error } = await supabase
    .from("campaigns")
    .update({ status: "pending_review", submitted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .in("status", ["draft", "needs_revision"])
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!updatedCampaign) return { ok: false, message: "Chiến dịch không tồn tại hoặc không thể gửi duyệt ở trạng thái hiện tại." };
  revalidatePath("/organization");
  revalidatePath("/admin");
  return { ok: true, message: "Đã gửi chiến dịch cho Admin xét duyệt." };
}
