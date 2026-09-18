"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");
  return { supabase, user };
}

export async function approveCampaign(id: string) {
  const { supabase, user } = await requireAdmin();
  await supabase
    .from("campaigns")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: null })
    .eq("id", id);
  revalidatePath("/admin");
}

export async function requestCampaignRevision(id: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  await supabase
    .from("campaigns")
    .update({ status: "needs_revision", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: note || null })
    .eq("id", id);
  revalidatePath("/admin");
}

export async function rejectCampaign(id: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  await supabase
    .from("campaigns")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: note || null })
    .eq("id", id);
  revalidatePath("/admin");
}

export async function approveOrganization(id: string) {
  const { supabase, user } = await requireAdmin();
  await supabase
    .from("organizations")
    .update({ license_status: "approved", verified_at: new Date().toISOString(), verified_by: user.id, license_note: null })
    .eq("id", id);
  revalidatePath("/admin");
}

export async function requestOrganizationRevision(id: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  await supabase
    .from("organizations")
    .update({ license_status: "needs_revision", verified_at: null, verified_by: user.id, license_note: note || null })
    .eq("id", id);
  revalidatePath("/admin");
}

export async function rejectOrganization(id: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  await supabase
    .from("organizations")
    .update({ license_status: "rejected", verified_at: null, verified_by: user.id, license_note: note || null })
    .eq("id", id);
  revalidatePath("/admin");
}

export async function postAuditDisbursement(id: string, result: "valid" | "needs_explanation" | "violation", formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  await supabase
    .from("disbursements")
    .update({
      post_audit_status: result,
      post_audited_by: user.id,
      post_audited_at: new Date().toISOString(),
      post_audit_note: note || null,
    })
    .eq("id", id);
  revalidatePath("/admin");
}

export async function approveRescueApplication(id: string) {
  const { supabase, user } = await requireAdmin();

  const { data: application } = await supabase
    .from("rescue_applications")
    .select("submitted_by, team_name, contact_name, resource_types, province, radius_km")
    .eq("id", id)
    .maybeSingle();

  await supabase
    .from("rescue_applications")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: null })
    .eq("id", id);

  // Chỉ activate ngay khi người nộp hồ sơ đã có tài khoản sẵn (submitted_by khác null).
  // Hồ sơ nộp ẩn danh cần tính năng mời qua email (rescue_invitations) — chưa làm ở đợt này.
  if (application?.submitted_by) {
    await supabase.from("rescue_teams").insert({
      user_id: application.submitted_by,
      application_id: id,
      name: application.team_name || application.contact_name || "Đội cứu trợ",
      resource_types: application.resource_types ?? [],
      province: application.province,
      radius_km: application.radius_km,
      status: "available",
      activated_by: user.id,
    });
    await supabase.from("profiles").update({ role: "rescue_team" }).eq("id", application.submitted_by);
  }

  revalidatePath("/admin");
}

export async function rejectRescueApplication(id: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  await supabase
    .from("rescue_applications")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.id, review_note: note || null })
    .eq("id", id);
  revalidatePath("/admin");
}

export async function markSosHandled(id: string) {
  const { supabase, user } = await requireAdmin();
  await supabase.from("sos_reports").update({ status: "handled", handled_at: new Date().toISOString(), handled_by: user.id }).eq("id", id);
  revalidatePath("/admin");
}
