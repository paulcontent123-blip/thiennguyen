"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { destroyCloudinaryAsset, uploadToCloudinary } from "@/lib/cloudinary/server";

export type DisbursementActionResult = { ok: true; message: string } | { ok: false; message: string };

const EVIDENCE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;
const MAX_EVIDENCE_FILES = 8;

async function requireOrganizationCampaign(campaignId: string) {
  const { supabase, user } = await requireActionRole(["org"]);
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id, slug, status, organization_id, organizations!inner(id, user_id, license_status, legal_representative_name)")
    .eq("id", campaignId)
    .eq("organizations.user_id", user.id)
    .maybeSingle();
  if (error || !campaign) throw new Error("Không tìm thấy chiến dịch thuộc tổ chức này.");
  const organization = Array.isArray(campaign.organizations) ? campaign.organizations[0] : campaign.organizations;
  return { supabase, user, campaign, organization };
}

function evidenceFiles(formData: FormData) {
  return formData.getAll("evidence").filter((value): value is File => value instanceof File && value.size > 0);
}

function disbursementError(message: string) {
  if (message.includes("DISBURSEMENT_EXCEEDS_RECEIVED_FUNDS")) return "Tổng các khoản giải ngân đã vượt số tiền chiến dịch thực nhận.";
  if (message.includes("REPRESENTATIVE_NAME_MISMATCH")) return "Tên xác nhận không khớp người đại diện pháp luật trong hồ sơ tổ chức.";
  if (message.includes("DISBURSEMENT_EVIDENCE_REQUIRED")) return "Hồ sơ phải có ít nhất một hóa đơn hoặc chứng từ.";
  if (message.includes("DISBURSEMENT_NOT_AWAITING_REPRESENTATIVE")) return "Hồ sơ không còn ở bước chờ người đại diện xác nhận.";
  if (message.includes("submit_disbursement_explanation") || message.includes("approve_disbursement_by_representative")) return "Database chưa được cập nhật migration luồng giải ngân.";
  return message;
}

export async function createDisbursement(campaignId: string, formData: FormData): Promise<DisbursementActionResult> {
  const { supabase, user, campaign, organization } = await requireOrganizationCampaign(campaignId);
  if (!organization || organization.license_status !== "approved") return { ok: false, message: "Tổ chức phải được xác minh trước khi tạo hồ sơ giải ngân." };
  if (!["active", "closed"].includes(campaign.status)) return { ok: false, message: "Chỉ chiến dịch đang hoạt động hoặc đã đóng mới được tạo hồ sơ giải ngân." };

  const amount = Number(String(formData.get("amount") ?? "").replace(/[^0-9]/g, ""));
  const description = String(formData.get("description") ?? "").trim();
  const files = evidenceFiles(formData);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 10_000_000_000) return { ok: false, message: "Số tiền giải ngân không hợp lệ." };
  if (description.length < 10 || description.length > 2000) return { ok: false, message: "Mô tả khoản chi phải từ 10 đến 2.000 ký tự." };
  if (files.length < 1 || files.length > MAX_EVIDENCE_FILES) return { ok: false, message: `Chọn từ 1 đến ${MAX_EVIDENCE_FILES} tệp chứng từ.` };
  if (files.some((file) => !EVIDENCE_TYPES.includes(file.type) || file.size > MAX_EVIDENCE_SIZE)
    || files.reduce((total, file) => total + file.size, 0) > MAX_EVIDENCE_SIZE) {
    return { ok: false, message: "Chứng từ phải là PDF/JPG/PNG/WebP và tổng dung lượng không vượt quá 10 MB." };
  }

  const uploaded: Array<{ secureUrl: string; publicId: string }> = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      uploaded.push(await uploadToCloudinary(file, `thiennguyen/disbursements/${organization.id}`, `${campaign.id}-${Date.now()}-${index + 1}`));
    }
    const { error } = await supabase.from("disbursements").insert({
      campaign_id: campaign.id,
      amount,
      description,
      status: "draft",
      evidence_paths: uploaded.map((item) => item.secureUrl),
      evidence_public_ids: uploaded.map((item) => item.publicId),
      submitted_by: user.id,
    });
    if (error) throw error;
  } catch (error) {
    await Promise.all(uploaded.map((item) => destroyCloudinaryAsset(item.publicId).catch(() => undefined)));
    return { ok: false, message: error instanceof Error ? error.message : "Không thể tạo hồ sơ giải ngân." };
  }

  revalidatePath(`/organization/campaigns/${campaignId}`);
  revalidatePath("/admin");
  return { ok: true, message: "Đã tạo bản nháp và lưu chứng từ giải ngân." };
}

export async function submitDisbursement(campaignId: string, disbursementId: string): Promise<DisbursementActionResult> {
  const { supabase } = await requireOrganizationCampaign(campaignId);
  const { data, error } = await supabase.from("disbursements")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", disbursementId).eq("campaign_id", campaignId).eq("status", "draft")
    .not("evidence_paths", "eq", "{}")
    .select("id").maybeSingle();
  if (error) return { ok: false, message: disbursementError(error.message) };
  if (!data) return { ok: false, message: "Bản nháp không tồn tại, thiếu chứng từ hoặc đã được gửi." };
  revalidatePath(`/organization/campaigns/${campaignId}`);
  return { ok: true, message: "Đã gửi hồ sơ đến bước xác nhận của người đại diện pháp luật." };
}

export async function approveDisbursementAsRepresentative(campaignId: string, disbursementId: string, formData: FormData): Promise<DisbursementActionResult> {
  const { supabase } = await requireOrganizationCampaign(campaignId);
  if (formData.get("confirmed") !== "yes") return { ok: false, message: "Người đại diện phải xác nhận chịu trách nhiệm về hồ sơ." };
  const representativeName = String(formData.get("representativeName") ?? "").trim();
  const { error } = await supabase.rpc("approve_disbursement_by_representative", {
    p_disbursement_id: disbursementId,
    p_representative_name: representativeName,
  });
  if (error) return { ok: false, message: disbursementError(error.message) };
  revalidatePath(`/organization/campaigns/${campaignId}`);
  revalidatePath("/admin");
  return { ok: true, message: "Đã xác nhận chữ ký người đại diện và gửi hồ sơ cho Admin hậu kiểm." };
}

export async function submitDisbursementExplanation(campaignId: string, disbursementId: string, formData: FormData): Promise<DisbursementActionResult> {
  const { supabase } = await requireOrganizationCampaign(campaignId);
  const explanation = String(formData.get("explanation") ?? "").trim();
  const { error } = await supabase.rpc("submit_disbursement_explanation", {
    p_disbursement_id: disbursementId,
    p_explanation: explanation,
  });
  if (error) return { ok: false, message: disbursementError(error.message) };
  revalidatePath(`/organization/campaigns/${campaignId}`);
  revalidatePath("/admin");
  return { ok: true, message: "Đã gửi giải trình bổ sung để Admin hậu kiểm lại." };
}
