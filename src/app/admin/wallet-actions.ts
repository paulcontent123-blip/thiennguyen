"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";

export type WalletTopupReviewResult = { ok: true; message: string } | { ok: false; message: string };

export async function confirmWalletTopup(id: string): Promise<WalletTopupReviewResult> {
  const { supabase, user } = await requireActionRole(["admin"]);
  const { data, error } = await supabase
    .from("wallet_topups")
    .update({ status: "completed", processed_by: user.id, admin_note: null })
    .eq("id", id)
    .eq("status", "pending")
    .select("tx_ref, amount_vnd")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Yêu cầu nạp không còn ở trạng thái chờ đối soát." };
  revalidatePath("/admin");
  revalidatePath("/wallet");
  return { ok: true, message: `Đã xác nhận ${data.tx_ref} và cộng ${Number(data.amount_vnd).toLocaleString("vi-VN")}đ vào ví.` };
}

export async function rejectWalletTopup(id: string, formData: FormData): Promise<WalletTopupReviewResult> {
  const { supabase, user } = await requireActionRole(["admin"]);
  const note = String(formData.get("note") ?? "").trim();
  if (note.length < 3) return { ok: false, message: "Nhập lý do không xác nhận (ít nhất 3 ký tự)." };
  const { data, error } = await supabase
    .from("wallet_topups")
    .update({ status: "rejected", processed_by: user.id, admin_note: note.slice(0, 500) })
    .eq("id", id)
    .eq("status", "pending")
    .select("tx_ref")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Yêu cầu nạp không còn ở trạng thái chờ đối soát." };
  revalidatePath("/admin");
  revalidatePath("/wallet");
  return { ok: true, message: `Đã từ chối ${data.tx_ref}.` };
}
