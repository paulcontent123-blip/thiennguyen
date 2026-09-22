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
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, message: "Không lấy được toạ độ hợp lệ." };
  }

  const { error } = await supabase.from("rescue_teams").update({ latitude, longitude }).eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/rescue/operations");
  return { ok: true, message: "Đã cập nhật vị trí hiện tại." };
}
