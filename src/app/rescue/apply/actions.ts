"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { APP_ROLES } from "@/lib/auth/roles";
import { uploadToCloudinary } from "@/lib/cloudinary/server";
import { PROVINCES } from "@/lib/geo/provinces";
import { RESCUE_RESOURCE_TYPES } from "@/lib/rescue/resource-types";

export type RescueApplyResult = { ok: true; message: string } | { ok: false; message: string };

const EVIDENCE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;
const MAX_EVIDENCE_FILES = 3;

export async function submitRescueApplication(formData: FormData): Promise<RescueApplyResult> {
  const { supabase, user } = await requireActionRole(APP_ROLES);

  const { data: existing } = await supabase
    .from("rescue_applications")
    .select("id, status")
    .eq("submitted_by", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing && (existing.status === "pending" || existing.status === "approved")) {
    return { ok: false, message: "Bạn đã có hồ sơ đang chờ duyệt hoặc đã được duyệt — không thể gửi thêm." };
  }

  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const teamName = String(formData.get("teamName") ?? "").trim();
  const affiliatedOrganization = String(formData.get("affiliatedOrganization") ?? "").trim();
  const province = String(formData.get("province") ?? "");
  const radiusKm = Number(formData.get("radiusKm") ?? 0);
  const resourceTypes = formData.getAll("resourceTypes").map(String).filter((type) => (RESCUE_RESOURCE_TYPES as readonly string[]).includes(type));

  if (contactName.length < 2 || contactName.length > 120) {
    return { ok: false, message: "Họ tên liên hệ chưa hợp lệ." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, message: "Email liên hệ không hợp lệ." };
  }
  if (contactPhone.length < 8 || contactPhone.length > 20) {
    return { ok: false, message: "Số điện thoại chưa hợp lệ." };
  }
  if (!PROVINCES.includes(province as (typeof PROVINCES)[number])) {
    return { ok: false, message: "Tỉnh/thành không hợp lệ." };
  }
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
    return { ok: false, message: "Bán kính hoạt động chưa hợp lệ." };
  }
  if (resourceTypes.length === 0) {
    return { ok: false, message: "Chọn ít nhất 1 loại nguồn lực." };
  }

  const files = formData.getAll("evidence").filter((value): value is File => value instanceof File && value.size > 0).slice(0, MAX_EVIDENCE_FILES);
  const evidencePaths: string[] = [];
  for (const file of files) {
    if (!EVIDENCE_TYPES.includes(file.type)) return { ok: false, message: "Tài liệu phải là PDF, JPG, PNG hoặc WebP." };
    if (file.size > MAX_EVIDENCE_SIZE) return { ok: false, message: "Mỗi tài liệu không được vượt quá 10MB." };
    try {
      const upload = await uploadToCloudinary(file, "thiennguyen/rescue-applications", `${user.id}-${Date.now()}-${evidencePaths.length}`);
      evidencePaths.push(upload.secureUrl);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Không thể tải tài liệu lên." };
    }
  }

  const { error } = await supabase.from("rescue_applications").insert({
    submitted_by: user.id,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    team_name: teamName || null,
    affiliated_organization: affiliatedOrganization || null,
    resource_types: resourceTypes,
    province,
    radius_km: radiusKm,
    evidence_paths: evidencePaths,
    status: "pending",
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/rescue/apply");
  revalidatePath("/admin");
  return { ok: true, message: "Đã gửi hồ sơ đăng ký cứu trợ. Admin sẽ xem xét và phản hồi sớm." };
}
