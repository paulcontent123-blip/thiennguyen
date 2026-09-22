"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { hashRescueActivationToken } from "@/lib/rescue/activation-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type RescueActivationResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * The public URL contains only the app activation token. This action is the
 * first place where the one-time Supabase invite token is verified, so an
 * email security scanner cannot consume it by visiting the landing page.
 */
export async function activateRescueInvitation(activationToken: string, password: string): Promise<RescueActivationResult> {
  const normalizedToken = activationToken.trim();
  if (normalizedToken.length < 32 || normalizedToken.length > 256) {
    return { ok: false, message: "Liên kết kích hoạt không hợp lệ." };
  }
  if (password.length < 8) {
    return { ok: false, message: "Mật khẩu phải có ít nhất 8 ký tự." };
  }

  let adminSupabase: ReturnType<typeof createAdminClient>;
  try {
    adminSupabase = createAdminClient();
  } catch (error) {
    console.error("Rescue activation is not configured", error);
    return { ok: false, message: "Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY." };
  }

  try {
    const { data: invitation, error: invitationError } = await adminSupabase
      .from("rescue_invitations")
      .select("id, user_id, email, token_hash, activation_token_hash, status, expires_at")
      .eq("activation_token_hash", hashRescueActivationToken(normalizedToken))
      .maybeSingle();

    if (invitationError) {
      console.error("Failed to read rescue activation invitation", invitationError);
      return { ok: false, message: "Không thể kiểm tra lời mời kích hoạt." };
    }
    if (!invitation) {
      return { ok: false, message: "Liên kết kích hoạt không hợp lệ hoặc đã được sử dụng." };
    }
    if (invitation.status !== "pending") {
      return { ok: false, message: "Lời mời này không còn ở trạng thái chờ kích hoạt." };
    }
    if (!invitation.user_id) {
      return { ok: false, message: "Lời mời chưa được liên kết với tài khoản cứu trợ." };
    }
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      return { ok: false, message: "Lời mời đã hết hạn. Vui lòng liên hệ Admin để gửi lại." };
    }

    const { data: team, error: teamError } = await adminSupabase
      .from("rescue_teams")
      .select("id, user_id, status")
      .eq("user_id", invitation.user_id)
      .maybeSingle();
    if (teamError) {
      console.error("Failed to read rescue team during activation", teamError);
      return { ok: false, message: "Không thể đọc hồ sơ đội cứu trợ." };
    }
    if (!team || team.status !== "inactive") {
      return { ok: false, message: "Hồ sơ đội cứu trợ không còn chờ kích hoạt." };
    }

    const supabase = createClient();
    const { data: verification, error: verificationError } = await supabase.auth.verifyOtp({
      token_hash: invitation.token_hash,
      type: "invite",
    });
    if (verificationError || !verification.user || verification.user.id !== invitation.user_id) {
      console.error("Failed to verify Supabase rescue invite token", { invitationId: invitation.id, verificationError });
      return { ok: false, message: "Token xác thực đã hết hạn hoặc không hợp lệ. Vui lòng liên hệ Admin để gửi lại lời mời." };
    }

    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      console.error("Failed to set rescue account password", { invitationId: invitation.id, passwordError });
      return { ok: false, message: "Không thể đặt mật khẩu lúc này. Vui lòng thử lại." };
    }

    const acceptedAt = new Date().toISOString();
    const { data: acceptedInvitation, error: acceptError } = await adminSupabase
      .from("rescue_invitations")
      .update({ status: "accepted", accepted_at: acceptedAt })
      .eq("id", invitation.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (acceptError || !acceptedInvitation) {
      console.error("Failed to accept rescue invitation", { invitationId: invitation.id, acceptError });
      return { ok: false, message: "Đã đặt mật khẩu nhưng chưa thể cập nhật trạng thái lời mời. Vui lòng liên hệ Admin." };
    }

    const { error: activationError } = await adminSupabase
      .from("rescue_teams")
      .update({ status: "available" })
      .eq("id", team.id)
      .eq("user_id", invitation.user_id)
      .eq("status", "inactive");
    if (activationError) {
      console.error("Failed to activate rescue team after invitation acceptance", { userId: invitation.user_id, activationError });
      return { ok: false, message: "Đã đặt mật khẩu nhưng chưa thể kích hoạt đội cứu trợ. Vui lòng liên hệ Admin." };
    }

    revalidatePath("/admin");
    revalidatePath("/rescue/operations");
    revalidatePath("/account");
    return { ok: true, message: "Đã xác nhận lời mời và đặt mật khẩu thành công." };
  } catch (error) {
    console.error("Unexpected rescue activation error", error);
    return { ok: false, message: "Không thể kích hoạt tài khoản cứu trợ lúc này." };
  }
}

export async function markRescueInvitationAccepted() {
  const { user } = await requireActionRole(["rescue_team"]);
  const email = user.email?.trim().toLowerCase();
  if (!email) return;

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("rescue_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("email", email)
    .eq("status", "pending");

  if (error) {
    console.error("Failed to mark rescue invitation as accepted", { email, error });
  }

  const { error: teamError } = await adminSupabase
    .from("rescue_teams")
    .update({ status: "available" })
    .eq("user_id", user.id)
    .eq("status", "inactive");

  if (teamError) {
    console.error("Failed to activate rescue team after invitation acceptance", { userId: user.id, teamError });
  }
}
