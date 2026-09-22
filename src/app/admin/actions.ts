"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { PROVINCES } from "@/lib/geo/provinces";
import { RESCUE_RESOURCE_TYPES } from "@/lib/rescue/resource-types";
import { createRescueActivationToken } from "@/lib/rescue/activation-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaignUpdateEmail, sendRescueInvitationEmail } from "@/lib/email/notifications";
import { createClient } from "@/lib/supabase/server";

function assertMutationSucceeded(error: { message: string } | null, fallbackMessage: string) {
  if (error) throw new Error(error.message || fallbackMessage);
}

async function requireAdmin() {
  return requireActionRole(["admin"]);
}

type RescueAccountResult = { ok: true; message: string } | { ok: false; message: string };

type RescueInvitationDeletionRow = {
  id: string;
  application_id: string | null;
  user_id?: string | null;
  email: string;
  token_hash: string;
  activation_token_hash?: string | null;
  status: "pending";
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  invited_by: string;
  created_at: string;
};

async function findAuthUserByEmail(adminSupabase: ReturnType<typeof createAdminClient>, email: string) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 200) return null;
  }
}

function rescueInviteRedirectUrl() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${appUrl}/rescue/accept`;
}

function rescueActivationUrl(token: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const activationUrl = new URL("/rescue/accept", appUrl);
  activationUrl.searchParams.set("token", token);
  return activationUrl.toString();
}

const rescueInvitationColumns = "id, application_id, user_id, email, token_hash, activation_token_hash, status, expires_at, accepted_at, revoked_at, invited_by, created_at";
const legacyRescueInvitationColumns = "id, application_id, email, token_hash, status, expires_at, accepted_at, revoked_at, invited_by, created_at";

async function readPendingRescueInvitations(
  adminSupabase: ReturnType<typeof createAdminClient>,
  filter: { email?: string; applicationId?: string },
) {
  async function run(columns: string) {
    let query = adminSupabase
      .from("rescue_invitations")
      .select(columns)
      .eq("status", "pending");
    if (filter.email) query = query.ilike("email", filter.email);
    if (filter.applicationId) query = query.eq("application_id", filter.applicationId);
    return query;
  }

  const currentResult = await run(rescueInvitationColumns);
  if (!currentResult.error) {
    return { data: (currentResult.data ?? []) as unknown as RescueInvitationDeletionRow[], error: null };
  }

  // Allow Admin to remove old direct Supabase invitations before the new
  // activation migration has reached the remote database.
  const legacyResult = await run(legacyRescueInvitationColumns);
  if (!legacyResult.error) {
    console.warn("Falling back to legacy rescue invitation columns; apply the custom activation migration before creating new invites.");
    return { data: (legacyResult.data ?? []) as unknown as RescueInvitationDeletionRow[], error: null };
  }

  return { data: [] as RescueInvitationDeletionRow[], error: currentResult.error };
}

async function rollbackRescueAccount(
  adminSupabase: ReturnType<typeof createAdminClient>,
  userId: string,
  teamId?: string,
  invitationId?: string,
) {
  if (invitationId) {
    await adminSupabase
      .from("rescue_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", invitationId)
      .then(({ error }) => {
        if (error) console.error("Failed to revoke rescue invitation during rollback", error);
      });
  }
  if (teamId) {
    await adminSupabase
      .from("rescue_teams")
      .delete()
      .eq("id", teamId)
      .then(({ error }) => {
        if (error) console.error("Failed to delete rescue team during rollback", error);
      });
  }
  const { error } = await adminSupabase.auth.admin.deleteUser(userId);
  if (error) console.error("Failed to delete rescue auth user during rollback", error);
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
  // Hồ sơ không gắn với tài khoản vẫn cần Admin dùng luồng mời trực tiếp bên dưới.
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

/**
 * Admin-only flow for inviting a rescue team that has not self-registered.
 * Supabase Auth admin APIs require the service-role key, so this action must
 * remain server-side and is protected by the normal Admin role check first.
 */
export async function createRescueAccount(formData: FormData): Promise<RescueAccountResult> {
  const { user: adminUser } = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const teamName = String(formData.get("teamName") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const radiusKm = Number(formData.get("radiusKm") ?? 0);
  const resourceTypes = Array.from(new Set(
    formData.getAll("resourceTypes").map(String).filter((type) => (RESCUE_RESOURCE_TYPES as readonly string[]).includes(type)),
  ));

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Email đội cứu trợ không hợp lệ." };
  }
  if (contactName.length < 2 || contactName.length > 120) {
    return { ok: false, message: "Tên người liên hệ không hợp lệ." };
  }
  if (teamName.length < 2 || teamName.length > 160) {
    return { ok: false, message: "Tên đội cứu trợ không hợp lệ." };
  }
  if (contactPhone && (contactPhone.length < 8 || contactPhone.length > 20)) {
    return { ok: false, message: "Số điện thoại không hợp lệ." };
  }
  if (!(PROVINCES as readonly string[]).includes(province)) {
    return { ok: false, message: "Tỉnh/thành hoạt động không hợp lệ." };
  }
  if (!Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > 500) {
    return { ok: false, message: "Bán kính hoạt động phải từ 1 đến 500 km." };
  }
  if (resourceTypes.length === 0) {
    return { ok: false, message: "Chọn ít nhất một loại nguồn lực." };
  }

  let adminSupabase: ReturnType<typeof createAdminClient>;
  try {
    adminSupabase = createAdminClient();
  } catch (error) {
    console.error("Rescue account creation is not configured", error);
    return { ok: false, message: "Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY." };
  }

  try {
    const existingUser = await findAuthUserByEmail(adminSupabase, email);
    if (existingUser) {
      return { ok: false, message: "Email này đã tồn tại. Không tự động đổi role tài khoản hiện hữu." };
    }

    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { full_name: contactName, account_type: "donor" },
        redirectTo: rescueInviteRedirectUrl(),
      },
    });
    if (linkError || !linkData?.user || !linkData.properties?.action_link) {
      return { ok: false, message: linkError?.message || "Không thể tạo lời mời tài khoản cứu trợ." };
    }

    const invitedUserId = linkData.user.id;
    const activationToken = createRescueActivationToken();
    let teamId: string | undefined;
    let invitationId: string | undefined;

    const { error: profileError } = await adminSupabase.from("profiles").upsert(
      { id: invitedUserId, role: "rescue_team", full_name: contactName, phone: contactPhone || null },
      { onConflict: "id" },
    );
    if (profileError) {
      await rollbackRescueAccount(adminSupabase, invitedUserId);
      return { ok: false, message: "Không thể gán role rescue_team cho tài khoản mới." };
    }

    const { data: team, error: teamError } = await adminSupabase
      .from("rescue_teams")
      .insert({
        user_id: invitedUserId,
        name: teamName,
        resource_types: resourceTypes,
        province,
        radius_km: radiusKm,
        status: "inactive",
        activated_by: adminUser.id,
      })
      .select("id")
      .single();
    if (teamError || !team) {
      await rollbackRescueAccount(adminSupabase, invitedUserId);
      return { ok: false, message: teamError?.message || "Không thể tạo hồ sơ đội cứu trợ." };
    }
    teamId = team.id;

    const configuredExpiryHours = Number(process.env.RESCUE_INVITATION_EXPIRY_HOURS ?? 1);
    const expiryHours = Number.isFinite(configuredExpiryHours) && configuredExpiryHours > 0 ? configuredExpiryHours : 1;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    const { data: invitation, error: invitationError } = await adminSupabase
      .from("rescue_invitations")
      .insert({
        user_id: invitedUserId,
        email,
        token_hash: linkData.properties.hashed_token,
        activation_token_hash: activationToken.tokenHash,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        invited_by: adminUser.id,
      })
      .select("id")
      .single();
    if (invitationError || !invitation) {
      await rollbackRescueAccount(adminSupabase, invitedUserId, teamId);
      return { ok: false, message: invitationError?.message || "Không thể lưu lời mời đội cứu trợ." };
    }
    invitationId = invitation.id;

    try {
      await sendRescueInvitationEmail({
        to: email,
        recipientName: contactName,
        teamName,
        province,
        actionLink: rescueActivationUrl(activationToken.token),
        invitationId: invitation.id,
        expiresAt: expiresAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
      });
    } catch (error) {
      console.error("Rescue invitation email failed", { email, error });
      await rollbackRescueAccount(adminSupabase, invitedUserId, teamId, invitationId);
      return { ok: false, message: "Không gửi được email mời. Tài khoản đã được rollback, hãy kiểm tra cấu hình Resend." };
    }

    revalidatePath("/admin");
    return { ok: true, message: `Đã tạo tài khoản rescue_team và gửi lời mời đến ${email}.` };
  } catch (error) {
    console.error("Unexpected rescue account creation error", error);
    return { ok: false, message: "Không thể tạo tài khoản cứu trợ lúc này." };
  }
}

/**
 * Admin-only hard delete for an inactive rescue team with a pending invitation.
 *
 * The rescue_teams.user_id foreign key uses ON DELETE RESTRICT, so the team
 * row must be removed before the Supabase Auth user. If Auth deletion fails,
 * the team row is restored to avoid leaving a rescue profile without a team.
 */
export async function deleteRescueTeam(teamId: string): Promise<RescueAccountResult> {
  await requireAdmin();

  const normalizedTeamId = teamId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedTeamId)) {
    return { ok: false, message: "Mã đội cứu trợ không hợp lệ." };
  }

  let adminSupabase: ReturnType<typeof createAdminClient>;
  try {
    adminSupabase = createAdminClient();
  } catch (error) {
    console.error("Rescue team deletion is not configured", error);
    return { ok: false, message: "Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY." };
  }

  try {
    const { data: team, error: teamReadError } = await adminSupabase
      .from("rescue_teams")
      .select("id, user_id, application_id, name, resource_types, province, radius_km, latitude, longitude, status, activated_at, activated_by, created_at, updated_at")
      .eq("id", normalizedTeamId)
      .maybeSingle();

    if (teamReadError) {
      console.error("Failed to read rescue team before deletion", teamReadError);
      return { ok: false, message: "Không thể đọc thông tin đội cứu trợ." };
    }
    if (!team) {
      return { ok: false, message: "Không tìm thấy đội cứu trợ hoặc đội đã được xóa." };
    }

    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", team.user_id)
      .maybeSingle();
    if (profileError) {
      console.error("Failed to read rescue team profile before deletion", profileError);
      return { ok: false, message: "Không thể xác minh tài khoản đội cứu trợ." };
    }
    if (!profile || profile.role !== "rescue_team") {
      return { ok: false, message: "Tài khoản liên kết không còn là rescue_team. Không thực hiện xóa tự động." };
    }

    const { data: authUser, error: authReadError } = await adminSupabase.auth.admin.getUserById(team.user_id);
    if (authReadError || !authUser.user) {
      console.error("Failed to read rescue Auth user before deletion", authReadError);
      return { ok: false, message: "Không thể xác minh tài khoản đăng nhập của đội cứu trợ." };
    }

    if (team.status !== "inactive") {
      return { ok: false, message: "Chỉ được xóa đội cứu trợ chưa kích hoạt." };
    }

    const invitationEmail = authUser.user.email?.trim().toLowerCase();
    if (!invitationEmail) {
      return { ok: false, message: "Tài khoản đội cứu trợ chưa có email để đối chiếu lời mời." };
    }

    const { data: emailInvitations, error: emailInvitationError } = await readPendingRescueInvitations(adminSupabase, { email: invitationEmail });
    if (emailInvitationError) {
      console.error("Failed to read pending rescue invitations", emailInvitationError);
      return { ok: false, message: "Không thể kiểm tra trạng thái lời mời đội cứu trợ." };
    }

    const pendingInvitations = new Map<string, RescueInvitationDeletionRow>();
    for (const invitation of (emailInvitations ?? []) as RescueInvitationDeletionRow[]) {
      pendingInvitations.set(invitation.id, invitation);
    }

    if (team.application_id) {
      const { data: applicationInvitations, error: applicationInvitationError } = await readPendingRescueInvitations(adminSupabase, { applicationId: team.application_id });
      if (applicationInvitationError) {
        console.error("Failed to read pending application rescue invitations", applicationInvitationError);
        return { ok: false, message: "Không thể kiểm tra lời mời gắn với hồ sơ đội cứu trợ." };
      }
      for (const invitation of (applicationInvitations ?? []) as RescueInvitationDeletionRow[]) {
        pendingInvitations.set(invitation.id, invitation);
      }
    }

    if (pendingInvitations.size === 0) {
      return { ok: false, message: "Chỉ được xóa khi đội đang có lời mời ở trạng thái Chờ duyệt." };
    }

    const invitationsToRestore = Array.from(pendingInvitations.values());
    const restorePendingInvitations = async () => {
      const { error } = await adminSupabase.from("rescue_invitations").insert(invitationsToRestore);
      return error;
    };

    const { error: invitationDeleteError } = await adminSupabase
      .from("rescue_invitations")
      .delete()
      .in("id", invitationsToRestore.map((invitation) => invitation.id));
    if (invitationDeleteError) {
      console.error("Failed to delete pending rescue invitations", invitationDeleteError);
      return { ok: false, message: "Không thể xóa lời mời đang chờ duyệt." };
    }

    const { error: teamDeleteError } = await adminSupabase
      .from("rescue_teams")
      .delete()
      .eq("id", normalizedTeamId);
    if (teamDeleteError) {
      const restoreError = await restorePendingInvitations();
      if (restoreError) console.error("Failed to restore invitations after team deletion failure", restoreError);
      console.error("Failed to delete rescue team", teamDeleteError);
      return { ok: false, message: "Không thể xóa hồ sơ đội cứu trợ." };
    }

    const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(team.user_id);
    if (authDeleteError) {
      const { error: restoreError } = await adminSupabase.from("rescue_teams").insert(team);
      const invitationRestoreError = await restorePendingInvitations();
      if (restoreError) {
        console.error("Failed to restore rescue team after Auth deletion failure", { authDeleteError, restoreError, invitationRestoreError });
        return { ok: false, message: "Không thể xóa tài khoản và không thể khôi phục hồ sơ đội. Cần kiểm tra dữ liệu ngay." };
      }
      if (invitationRestoreError) {
        console.error("Failed to restore invitations after Auth deletion failure", { authDeleteError, invitationRestoreError });
        return { ok: false, message: "Tài khoản chưa bị xóa nhưng không thể khôi phục lời mời. Cần kiểm tra dữ liệu ngay." };
      }
      console.error("Failed to delete rescue Auth user; rescue team was restored", authDeleteError);
      return { ok: false, message: "Không thể xóa tài khoản đăng nhập. Hồ sơ đội đã được khôi phục." };
    }

    revalidatePath("/admin");
    revalidatePath("/rescue/operations");
    revalidatePath("/account");
    return { ok: true, message: `Đã xóa đội cứu trợ “${team.name}”, tài khoản đăng nhập và lời mời đang chờ.` };
  } catch (error) {
    console.error("Unexpected rescue team deletion error", error);
    return { ok: false, message: "Không thể xóa đội cứu trợ lúc này." };
  }
}

/**
 * Remove an invitation that has already been revoked. Pending invitations
 * must go through the rescue-team deletion flow, while accepted invitations
 * are retained as audit history.
 */
export async function deleteRescueInvitation(invitationId: string): Promise<RescueAccountResult> {
  await requireAdmin();

  const normalizedInvitationId = invitationId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedInvitationId)) {
    return { ok: false, message: "Mã lời mời không hợp lệ." };
  }

  let adminSupabase: ReturnType<typeof createAdminClient>;
  try {
    adminSupabase = createAdminClient();
  } catch (error) {
    console.error("Rescue invitation deletion is not configured", error);
    return { ok: false, message: "Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY." };
  }

  try {
    const { data: invitation, error: invitationReadError } = await adminSupabase
      .from("rescue_invitations")
      .select("id, status")
      .eq("id", normalizedInvitationId)
      .maybeSingle();

    if (invitationReadError) {
      console.error("Failed to read rescue invitation before deletion", invitationReadError);
      return { ok: false, message: "Không thể đọc lời mời cứu trợ." };
    }
    if (!invitation) {
      return { ok: false, message: "Không tìm thấy lời mời hoặc lời mời đã được xóa." };
    }
    if (invitation.status !== "revoked") {
      return { ok: false, message: "Chỉ được xóa lời mời đã thu hồi." };
    }

    const { error: deleteError } = await adminSupabase
      .from("rescue_invitations")
      .delete()
      .eq("id", normalizedInvitationId)
      .eq("status", "revoked");
    if (deleteError) {
      console.error("Failed to delete revoked rescue invitation", deleteError);
      return { ok: false, message: "Không thể xóa lời mời đã thu hồi." };
    }

    revalidatePath("/admin");
    return { ok: true, message: "Đã xóa lời mời đã thu hồi." };
  } catch (error) {
    console.error("Unexpected rescue invitation deletion error", error);
    return { ok: false, message: "Không thể xóa lời mời cứu trợ lúc này." };
  }
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
