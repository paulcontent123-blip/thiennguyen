"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";

export type RescueOperationsResult = { ok: true; message: string } | { ok: false; message: string };

const STATUS_VALUES = ["available", "en_route", "busy", "inactive"] as const;

export async function updateRescueStatus(status: string): Promise<RescueOperationsResult> {
  const { supabase, user } = await requireActionRole(["rescue_team"]);

  if (!STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])) {
    return { ok: false, message: "Trạng thái không hợp lệ." };
  }

  const { error } = await supabase.from("rescue_teams").update({ status }).eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/rescue/operations");
  return { ok: true, message: "Đã cập nhật trạng thái." };
}

export async function updateRescueLocation(formData: FormData): Promise<RescueOperationsResult> {
  const { supabase, user } = await requireActionRole(["rescue_team"]);

  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, message: "Không lấy được toạ độ hợp lệ." };
  }

  const { error } = await supabase.from("rescue_teams").update({ latitude, longitude }).eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/rescue/operations");
  return { ok: true, message: "Đã cập nhật vị trí hiện tại." };
}

export async function acknowledgeSosAlert(alertId: string): Promise<RescueOperationsResult> {
  const { supabase } = await requireActionRole(["rescue_team"]);
  if (!/^[0-9a-f-]{36}$/i.test(alertId)) return { ok: false, message: "Cảnh báo không hợp lệ." };
  const { data, error } = await supabase.rpc("acknowledge_sos_team_alert", { p_alert_id: alertId });
  if (error || !data) return { ok: false, message: "Không thể xác nhận cảnh báo này." };
  revalidatePath("/rescue/operations");
  return { ok: true, message: "Đã xác nhận đã xem cảnh báo." };
}

const PROGRESS_STATUSES = ["en_route", "on_scene", "completed", "cannot_assist"] as const;

export async function reportSosProgress(alertId: string, status: string, note: string): Promise<RescueOperationsResult> {
  const { supabase } = await requireActionRole(["rescue_team"]);
  if (!/^[0-9a-f-]{36}$/i.test(alertId)) return { ok: false, message: "Cảnh báo không hợp lệ." };
  if (!PROGRESS_STATUSES.includes(status as (typeof PROGRESS_STATUSES)[number])) return { ok: false, message: "Trạng thái không hợp lệ." };
  const trimmed = note.trim();
  if (trimmed.length > 500) return { ok: false, message: "Ghi chú tối đa 500 ký tự." };
  if (status === "cannot_assist" && !trimmed) return { ok: false, message: "Cần ghi lý do khi không hỗ trợ được." };

  const { data, error } = await supabase.rpc("report_sos_team_progress", { p_alert_id: alertId, p_status: status, p_note: trimmed || null });
  if (error || !data) return { ok: false, message: "Không thể gửi cập nhật cho cảnh báo này." };

  revalidatePath("/rescue/operations");
  revalidatePath("/admin");
  revalidatePath("/admin/sos");
  return {
    ok: true,
    message: data === "closed"
      ? "Đã báo xử lý xong. SOS được tự động đóng theo thiết lập của Admin."
      : status === "completed"
        ? "Đã báo xử lý xong. Admin sẽ xác nhận để đóng SOS."
        : "Đã gửi cập nhật tới Admin.",
  };
}
