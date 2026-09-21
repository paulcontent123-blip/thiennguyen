"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";

function assertMutationSucceeded(error: { message: string } | null, fallbackMessage: string) {
  if (error) throw new Error(error.message || fallbackMessage);
}

async function requireAdmin() {
  return requireActionRole(["admin"]);
}

export async function approveCampaign(id: string) {
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: null })
    .eq("id", id);
  assertMutationSucceeded(error, "Không thể duyệt chiến dịch.");
  revalidatePath("/admin");
}

export async function requestCampaignRevision(id: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "needs_revision", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: note || null })
    .eq("id", id);
  assertMutationSucceeded(error, "Không thể yêu cầu bổ sung chiến dịch.");
  revalidatePath("/admin");
}

export async function rejectCampaign(id: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: note || null })
    .eq("id", id);
  assertMutationSucceeded(error, "Không thể từ chối chiến dịch.");
  revalidatePath("/admin");
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
