"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getCurrentAuth } from "@/lib/auth/server";
import { uploadToCloudinary } from "@/lib/cloudinary/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { SOS_NEEDS } from "@/lib/sos/needs";

export type SosActionResult = { ok: true; message: string } | { ok: false; message: string };

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE = 8 * 1024 * 1024;
const ANON_LIMIT_PER_HOUR = 5;
const anonymousHits = new Map<string, number[]>();

function getFile(formData: FormData, field: string) {
  const value = formData.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

// Giới hạn theo IP ở mức best-effort (bộ nhớ của từng instance); giới hạn theo số điện thoại nằm ở trigger DB.
function isAnonymousRateLimited() {
  const forwarded = headers().get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const recent = (anonymousHits.get(ip) ?? []).filter((time) => now - time < 3_600_000);
  if (recent.length >= ANON_LIMIT_PER_HOUR) {
    anonymousHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  anonymousHits.set(ip, recent);
  return false;
}

export async function submitSosReport(formData: FormData): Promise<SosActionResult> {
  if (!hasSupabaseEnv()) return { ok: false, message: "Hệ thống chưa được cấu hình." };

  // Ô ẩn chống bot: người thật không điền.
  if (String(formData.get("website") ?? "").trim()) return { ok: true, message: "Đã gửi tín hiệu SOS." };

  const { user } = await getCurrentAuth();
  const isAnonymous = !user;

  const locationText = String(formData.get("locationText") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const latitudeRaw = String(formData.get("latitude") ?? "").trim();
  const longitudeRaw = String(formData.get("longitude") ?? "").trim();
  const needs = formData.getAll("needs").map(String).filter((need) => (SOS_NEEDS as readonly string[]).includes(need));
  const photo = getFile(formData, "photo");
  const requestCampaign = formData.get("requestCampaign") === "on";
  const campaignTitle = String(formData.get("campaignTitle") ?? "").trim();
  const campaignTarget = Number(formData.get("campaignTarget"));
  const campaignEmail = String(formData.get("campaignEmail") ?? "").trim().toLowerCase();

  if (locationText.length < 5 || locationText.length > 200) {
    return { ok: false, message: "Vui lòng mô tả vị trí cụ thể hơn (ít nhất 5 ký tự)." };
  }
  if (description.length > 1000) {
    return { ok: false, message: "Mô tả tối đa 1000 ký tự." };
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
  if (requestCampaign && (
    campaignTitle.length < 8 || campaignTitle.length > 180
    || !Number.isInteger(campaignTarget) || campaignTarget < 100000 || campaignTarget > 100000000000
    || (campaignEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campaignEmail))
  )) {
    return { ok: false, message: "Thông tin đề xuất gây quỹ chưa hợp lệ (tiêu đề 8–180 ký tự, mục tiêu tối thiểu 100.000đ)." };
  }
  if (isAnonymous && isAnonymousRateLimited()) {
    return { ok: false, message: "Bạn đã gửi quá nhiều báo cáo trong 1 giờ. Vui lòng thử lại sau hoặc đăng nhập." };
  }

  const latitude = latitudeRaw ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw) : null;
  if ((latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
    || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    || (latitude === null) !== (longitude === null)) {
    return { ok: false, message: "Tọa độ GPS chưa hợp lệ. Hãy lấy lại vị trí hoặc để trống cả hai tọa độ." };
  }

  let photoUpload;
  try {
    photoUpload = await uploadToCloudinary(photo, "thiennguyen/sos", `${user?.id ?? "guest"}-sos-${Date.now()}-${randomUUID().slice(0, 8)}`);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không thể tải ảnh lên." };
  }

  const supabase = createClient();
  const reportId = randomUUID();
  const { error } = await supabase.from("sos_reports").insert({
    id: reportId,
    reported_by: user?.id ?? null,
    location_text: locationText,
    latitude,
    longitude,
    needs,
    contact_phone: contactPhone,
    description: description || null,
    photo_url: photoUpload.secureUrl,
    photo_public_id: photoUpload.publicId,
    status: isAnonymous ? "pending_review" : "needs_support",
  });

  if (error) {
    if (isAnonymous && error.message.includes("Too many anonymous SOS")) {
      return { ok: false, message: "Số điện thoại này đã gửi quá nhiều báo cáo trong 1 giờ. Vui lòng thử lại sau." };
    }
    return { ok: false, message: isAnonymous ? "Không thể gửi báo cáo lúc này. Vui lòng thử lại." : error.message };
  }

  if (requestCampaign) {
    const { error: requestError } = await supabase.from("sos_campaign_requests").insert({
      sos_report_id: reportId,
      requested_by: user?.id ?? null,
      title: campaignTitle,
      target_amount: campaignTarget,
      contact_phone: contactPhone,
      contact_email: campaignEmail || null,
    });
    if (requestError) {
      console.error("SOS fundraising request failed", { reportId, code: requestError.code });
      revalidatePath("/sos");
      revalidatePath("/admin");
      return { ok: true, message: "Tín hiệu SOS đã được ghi nhận, nhưng đề xuất gây quỹ chưa lưu được. Vui lòng liên hệ Admin; không cần gửi lại SOS." };
    }
  }

  revalidatePath("/sos");
  revalidatePath("/admin");
  return {
    ok: true,
    message: isAnonymous
      ? `Đã gửi tín hiệu SOS. Báo cáo đang chờ Admin xác nhận trước khi hiển thị công khai và chuyển tới đội cứu trợ.${requestCampaign ? " Đề xuất gây quỹ cũng đang chờ Admin xét duyệt." : ""}`
      : `Đã gửi tín hiệu SOS. Đội cứu trợ và Admin sẽ xem xét sớm nhất.${requestCampaign ? " Đề xuất gây quỹ đang chờ Admin xét duyệt." : ""}`,
  };
}
