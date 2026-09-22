"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { sendCampaignUpdateEmail } from "@/lib/email/notifications";
import { createClient } from "@/lib/supabase/server";

function assertMutationSucceeded(error: { message: string } | null, fallbackMessage: string) {
  if (error) throw new Error(error.message || fallbackMessage);
}

async function requireAdmin() {
  return requireActionRole(["admin"]);
}

async function notifyCampaignOwner(
  supabase: ReturnType<typeof createClient>,
  campaign: { id: string; title: string; organization_id: string },
  status: string,
  statusLabel: string,
  note?: string | null,
) {
  const { data: organization } = await supabase
    .from("organizations")
    .select("legal_representative_email")
    .eq("id", campaign.organization_id)
    .maybeSingle();
  const recipient = organization?.legal_representative_email?.trim();
  if (!recipient) return;

  try {
    await sendCampaignUpdateEmail({
      to: recipient,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      status,
      statusLabel,
      note,
      campaignUrl: `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/organization/campaigns/${campaign.id}`,
    });
  } catch (error) {
    console.error("Campaign update email failed", { campaignId: campaign.id, status, error });
  }
}

export async function approveCampaign(id: string) {
  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase
    .from("campaigns")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: null })
    .eq("id", id)
    .eq("status", "pending_review")
    .select("id, title, organization_id")
    .maybeSingle();
  assertMutationSucceeded(error, "Không thể duyệt chiến dịch.");
  if (!data) throw new Error("Chiến dịch không còn ở trạng thái chờ duyệt.");
  await notifyCampaignOwner(supabase, data, "approved", "Đã duyệt");
  revalidatePath("/admin");
  revalidatePath("/organization");
}

export async function requestCampaignRevision(id: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  if (!note) throw new Error("Cần nhập lý do yêu cầu chỉnh sửa.");
  const { data, error } = await supabase
    .from("campaigns")
    .update({ status: "needs_revision", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: note })
    .eq("id", id)
    .eq("status", "pending_review")
    .select("id, title, organization_id")
    .maybeSingle();
  assertMutationSucceeded(error, "Không thể yêu cầu bổ sung chiến dịch.");
  if (!data) throw new Error("Chiến dịch không còn ở trạng thái chờ duyệt.");
  await notifyCampaignOwner(supabase, data, "needs_revision", "Cần chỉnh sửa", note);
  revalidatePath("/admin");
  revalidatePath("/organization");
}

export async function rejectCampaign(id: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  if (!note) throw new Error("Cần nhập lý do từ chối chiến dịch.");
  const { data, error } = await supabase
    .from("campaigns")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: note })
    .eq("id", id)
    .eq("status", "pending_review")
    .select("id, title, organization_id")
    .maybeSingle();
  assertMutationSucceeded(error, "Không thể từ chối chiến dịch.");
  if (!data) throw new Error("Chiến dịch không còn ở trạng thái chờ duyệt.");
  await notifyCampaignOwner(supabase, data, "rejected", "Từ chối", note);
  revalidatePath("/admin");
  revalidatePath("/organization");
}

export async function activateCampaign(id: string) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("campaigns")
    .update({ status: "active", published_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "approved")
    .select("id, title, organization_id")
    .maybeSingle();
  assertMutationSucceeded(error, "Không thể kích hoạt chiến dịch.");
  if (!data) throw new Error("Chiến dịch không còn ở trạng thái đã duyệt.");
  await notifyCampaignOwner(supabase, data, "active", "Đang hoạt động");
  revalidatePath("/admin");
  revalidatePath("/organization");
  revalidatePath("/");
}

export async function closeCampaign(id: string) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("campaigns")
    .update({ status: "closed" })
    .eq("id", id)
    .eq("status", "active")
    .select("id, title, organization_id")
    .maybeSingle();
  assertMutationSucceeded(error, "Không thể đóng chiến dịch.");
  if (!data) throw new Error("Chiến dịch không còn ở trạng thái hoạt động.");
  await notifyCampaignOwner(supabase, data, "closed", "Đã đóng");
  revalidatePath("/admin");
  revalidatePath("/organization");
  revalidatePath("/");
}

export async function approveOrganization(id: string) {
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase
    .from("organizations")
    .update({ license_status: "approved", verified_at: new Date().toISOString(), verified_by: user.id, license_note: null })
    .eq("id", id);
  assertMutationSucceeded(error, "Không thể xác minh giấy phép tổ chức.");
  revalidatePath("/admin");
}

export async function requestOrganizationRevision(id: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  const { error } = await supabase
    .from("organizations")
    .update({ license_status: "needs_revision", verified_at: null, verified_by: user.id, license_note: note || null })
    .eq("id", id);
  assertMutationSucceeded(error, "Không thể yêu cầu bổ sung giấy phép.");
  revalidatePath("/admin");
}

export async function rejectOrganization(id: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  const { error } = await supabase
    .from("organizations")
    .update({ license_status: "rejected", verified_at: null, verified_by: user.id, license_note: note || null })
    .eq("id", id);
  assertMutationSucceeded(error, "Không thể từ chối giấy phép tổ chức.");
  revalidatePath("/admin");
}

export async function postAuditDisbursement(id: string, result: "valid" | "needs_explanation" | "violation", formData: FormData) {
  const { supabase, user } = await requireAdmin();
  if (!["valid", "needs_explanation", "violation"].includes(result)) {
    throw new Error("Kết quả hậu kiểm không hợp lệ.");
  }
  const note = String(formData.get("note") ?? "").trim();
  const { error } = await supabase
    .from("disbursements")
    .update({
      post_audit_status: result,
      post_audited_by: user.id,
      post_audited_at: new Date().toISOString(),
      post_audit_note: note || null,
    })
    .eq("id", id);
  assertMutationSucceeded(error, "Không thể cập nhật kết quả hậu kiểm.");
  revalidatePath("/admin");
}

export async function approveRescueApplication(id: string) {
  const { supabase, user } = await requireAdmin();

  const { data: application, error: applicationError } = await supabase
    .from("rescue_applications")
    .select("submitted_by, team_name, contact_name, resource_types, province, radius_km, status")
    .eq("id", id)
    .maybeSingle();
  assertMutationSucceeded(applicationError, "Không thể đọc hồ sơ cứu trợ.");
  if (!application) throw new Error("Không tìm thấy hồ sơ cứu trợ.");
  if (application.status !== "pending") throw new Error("Hồ sơ cứu trợ không còn ở trạng thái chờ duyệt.");

  const { error: reviewError } = await supabase
    .from("rescue_applications")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: null })
    .eq("id", id);
  assertMutationSucceeded(reviewError, "Không thể duyệt hồ sơ cứu trợ.");

  // Chỉ activate ngay khi người nộp hồ sơ đã có tài khoản sẵn (submitted_by khác null).
  // Hồ sơ nộp ẩn danh cần tính năng mời qua email (rescue_invitations) — chưa làm ở đợt này.
  if (application?.submitted_by) {
    const { error: teamError } = await supabase.from("rescue_teams").insert({
      user_id: application.submitted_by,
      application_id: id,
      name: application.team_name || application.contact_name || "Đội cứu trợ",
      resource_types: application.resource_types ?? [],
      province: application.province,
      radius_km: application.radius_km,
      status: "available",
      activated_by: user.id,
    });
    assertMutationSucceeded(teamError, "Không thể kích hoạt hồ sơ đội cứu trợ.");

    const { error: roleError } = await supabase.from("profiles").update({ role: "rescue_team" }).eq("id", application.submitted_by);
    assertMutationSucceeded(roleError, "Không thể cấp role rescue_team.");
  }

  revalidatePath("/admin");
}

export async function rejectRescueApplication(id: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  const { error } = await supabase
    .from("rescue_applications")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: note || null })
    .eq("id", id);
  assertMutationSucceeded(error, "Không thể từ chối hồ sơ cứu trợ.");
  revalidatePath("/admin");
}

export async function markSosHandled(id: string) {
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase
    .from("sos_reports")
    .update({ status: "handled", handled_at: new Date().toISOString(), handled_by: user.id })
    .eq("id", id);
  assertMutationSucceeded(error, "Không thể cập nhật SOS report.");
  revalidatePath("/admin");
}
