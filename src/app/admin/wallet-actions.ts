"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { sendWalletTopupCompletedEmail } from "@/lib/email/notifications";
import { notifyUser } from "@/lib/notifications/create";
import { createAdminClient } from "@/lib/supabase/admin";

export type WalletTopupReviewResult = { ok: true; message: string } | { ok: false; message: string };

export async function confirmWalletTopup(id: string): Promise<WalletTopupReviewResult> {
  const { supabase, user } = await requireActionRole(["admin"]);
  const { data, error } = await supabase
    .from("wallet_topups")
    .update({ status: "completed", processed_by: user.id, admin_note: null })
    .eq("id", id)
    .eq("status", "pending")
    .select("tx_ref, amount_vnd, user_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Yêu cầu nạp không còn ở trạng thái chờ đối soát." };
  revalidatePath("/admin");
  revalidatePath("/wallet");

  try {
    const { data: authUser } = await createAdminClient().auth.admin.getUserById(data.user_id);
    if (authUser.user?.email) {
      await sendWalletTopupCompletedEmail({
        to: authUser.user.email, donorName: authUser.user.user_metadata?.full_name ?? null,
        txRef: data.tx_ref, amountVnd: Number(data.amount_vnd),
      });
    }
  } catch (emailError) {
    console.error("Failed to notify donor of wallet top-up completion", { txRef: data.tx_ref, emailError });
  }
  await notifyUser({
    userId: data.user_id, category: "payment_completed",
    title: `Đã cộng ${Number(data.amount_vnd).toLocaleString("vi-VN")}đ vào ví`,
    body: `Admin đã đối soát và xác nhận yêu cầu nạp ví ${data.tx_ref}.`,
    link: "/wallet",
  });

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
    .select("tx_ref, user_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Yêu cầu nạp không còn ở trạng thái chờ đối soát." };
  revalidatePath("/admin");
  revalidatePath("/wallet");
  await notifyUser({
    userId: data.user_id, category: "payment_rejected",
    title: `Yêu cầu nạp ví ${data.tx_ref} không được xác nhận`,
    body: note,
    link: "/wallet",
  });
  return { ok: true, message: `Đã từ chối ${data.tx_ref}.` };
}

export async function reverseWalletAllocation(id: string, formData: FormData): Promise<WalletTopupReviewResult> {
  const { supabase } = await requireActionRole(["admin"]);
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return { ok: false, message: "Nhập lý do hoàn tác (ít nhất 3 ký tự)." };
  const { error } = await supabase.rpc("reverse_wallet_allocation", {
    p_allocation_id: id,
    p_reason: reason,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin");
  revalidatePath("/wallet");
  revalidatePath("/account");
  revalidatePath("/campaigns");
  return { ok: true, message: "Đã hoàn tác phân bổ, hoàn số dư ví và chuyển giao dịch sang trạng thái hoàn tiền." };
}
