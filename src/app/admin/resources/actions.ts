"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";

export type ResourceAdminResult = { ok: true; message: string } | { ok: false; message: string };

function refreshResourcePages() {
  revalidatePath("/admin");
  revalidatePath("/admin/resources");
  revalidatePath("/organization");
  revalidatePath("/donate-items");
  revalidatePath("/campaigns/[slug]", "page");
}

function formText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function reviewResourceNeed(
  id: string,
  decision: "approved" | "rejected",
  formData: FormData,
): Promise<ResourceAdminResult> {
  const { supabase, user } = await requireActionRole(["admin"]);
  const note = formText(formData, "note");
  if (decision === "rejected" && note.length < 5) {
    return { ok: false, message: "Nhập lý do từ chối (ít nhất 5 ký tự)." };
  }

  const { data, error } = await supabase
    .from("resource_needs")
    .update({
      moderation_status: decision,
      review_note: note || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      ...(decision === "rejected" ? { status: "closed" } : {}),
    })
    .eq("id", id)
    .eq("moderation_status", "pending_review")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Nhu cầu đã được xử lý hoặc không còn tồn tại. Hãy tải lại danh sách." };
  refreshResourcePages();
  return { ok: true, message: decision === "approved" ? "Đã duyệt và công khai nhu cầu." : "Đã từ chối nhu cầu." };
}

export async function reviewResourceClaim(
  id: string,
  decision: "confirm_match" | "reject_match" | "delivered" | "failed",
  formData: FormData,
): Promise<ResourceAdminResult> {
  const { supabase, user } = await requireActionRole(["admin"]);
  const note = formText(formData, "note");
  const quantityText = formText(formData, "deliveredQuantity");
  const valueText = formText(formData, "actualValueVnd");
  const deliveredQuantity = quantityText ? Number(quantityText) : null;
  const actualValueVnd = valueText ? Number(valueText) : null;

  if (["reject_match", "delivered", "failed"].includes(decision) && note.length < 3) {
    return { ok: false, message: "Cần ghi chú xác minh hoặc lý do xử lý (ít nhất 3 ký tự)." };
  }
  if (decision === "delivered" && (!deliveredQuantity || !Number.isFinite(deliveredQuantity))) {
    return { ok: false, message: "Nhập số lượng thực nhận đã xác minh." };
  }
  if (actualValueVnd !== null && (!Number.isFinite(actualValueVnd) || actualValueVnd < 0)) {
    return { ok: false, message: "Giá trị thực tế không hợp lệ." };
  }

  const now = new Date().toISOString();
  const patch = decision === "confirm_match"
    ? { status: "confirmed", confirmed_at: now, processed_by: user.id, coordination_note: note || "Admin đã xác minh ghép." }
    : decision === "delivered"
      ? { status: "delivered", delivered_at: now, delivered_quantity: deliveredQuantity, actual_value_vnd: actualValueVnd, processed_by: user.id, coordination_note: note }
      : { status: decision === "reject_match" ? "failed" : "failed", processed_by: user.id, coordination_note: note, delivered_quantity: null };

  let query = supabase.from("resource_claims").update(patch).eq("id", id);
  query = decision === "confirm_match" || decision === "reject_match"
    ? query.eq("status", "reserved")
    : decision === "delivered" || decision === "failed"
      ? query.eq("status", "confirmed")
      : query;

  const { data, error } = await query.select("id").maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Lượt đăng ký đã được xử lý hoặc trạng thái đã thay đổi. Hãy tải lại danh sách." };
  refreshResourcePages();
  const message = decision === "confirm_match"
    ? "Đã xác minh và xác nhận ghép nguồn lực."
    : decision === "delivered"
      ? `Đã xác minh bàn giao ${deliveredQuantity} đơn vị.`
      : decision === "reject_match" ? "Đã từ chối kết quả ghép." : "Đã ghi nhận bàn giao không thành công.";
  return { ok: true, message };
}

export async function matchResourceOfferAsAdmin(formData: FormData): Promise<ResourceAdminResult> {
  const { supabase } = await requireActionRole(["admin"]);
  const needId = formText(formData, "needId");
  const offerId = formText(formData, "offerId");
  const quantity = Number(formText(formData, "quantity"));
  if (!needId || !offerId || !Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, message: "Chọn nhu cầu, nguồn lực và số lượng ghép hợp lệ." };
  }

  const { error } = await supabase.rpc("match_resource_offer", {
    p_offer_id: offerId,
    p_need_id: needId,
    p_quantity: quantity,
  });
  if (error) return { ok: false, message: error.message };
  refreshResourcePages();
  return { ok: true, message: "Đã xác minh và ghép nguồn lực với nhu cầu." };
}
