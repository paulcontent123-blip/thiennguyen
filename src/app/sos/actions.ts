"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { APP_ROLES } from "@/lib/auth/roles";
import { uploadToCloudinary } from "@/lib/cloudinary/server";
import { SOS_NEEDS } from "@/lib/sos/needs";

export type SosActionResult = { ok: true; message: string } | { ok: false; message: string };

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE = 8 * 1024 * 1024;

function getFile(formData: FormData, field: string) {
  const value = formData.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function submitSosReport(formData: FormData): Promise<SosActionResult> {
  const { supabase, user } = await requireActionRole(APP_ROLES);

  const locationText = String(formData.get("locationText") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const latitudeRaw = String(formData.get("latitude") ?? "").trim();
  const longitudeRaw = String(formData.get("longitude") ?? "").trim();
  const needs = formData.getAll("needs").map(String).filter((need) => (SOS_NEEDS as readonly string[]).includes(need));
  const photo = getFile(formData, "photo");

  if (locationText.length < 5 || locationText.length > 200) {
    return { ok: false, message: "Vui lòng mô tả vị trí cụ thể hơn (ít nhất 5 ký tự)." };
  }
  if (contactPhone.length < 8 || contactPhone.length > 20) {
    return { ok: false, message: "Số điện thoại liên hệ chưa hợp lệ." };
  }
  if (needs.length === 0) {
    return { ok: false, message: "Chọn ít nhất 1 nhu cầu khẩn cấp." };
  }
  if (!photo) {
    return { ok: false, message: "Cần đính kèm ảnh hiện trường làm bằng chứng." };
  }
  if (!PHOTO_TYPES.includes(photo.type)) {
    return { ok: false, message: "Ảnh phải là JPG, PNG hoặc WebP." };
  }
  if (photo.size > MAX_PHOTO_SIZE) {
    return { ok: false, message: "Ảnh không được vượt quá 8MB." };
  }

  const latitude = latitudeRaw ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw) : null;

  let photoUpload;
  try {
    photoUpload = await uploadToCloudinary(photo, "thiennguyen/sos", `${user.id}-sos-${Date.now()}`);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không thể tải ảnh lên." };
  }

  const { error } = await supabase.from("sos_reports").insert({
    reported_by: user.id,
    location_text: locationText,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    needs,
    contact_phone: contactPhone,
    description: description || null,
    photo_url: photoUpload.secureUrl,
    photo_public_id: photoUpload.publicId,
    status: "needs_support",
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/sos");
  revalidatePath("/admin");
  return { ok: true, message: "Đã gửi tín hiệu SOS. Đội cứu trợ và Admin sẽ xem xét sớm nhất." };
}
