"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { APP_ROLES } from "@/lib/auth/roles";

export type AccountActionResult = { ok: true; message: string } | { ok: false; message: string };

export async function updateProfile(formData: FormData): Promise<AccountActionResult> {
  const { supabase, user } = await requireActionRole(APP_ROLES);
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (fullName.length < 2 || fullName.length > 100) {
    return { ok: false, message: "Họ tên phải có từ 2 đến 100 ký tự." };
  }
  if (phone.length > 20 || (phone && !/^[+\d][\d\s.-]+$/.test(phone))) {
    return { ok: false, message: "Số điện thoại không hợp lệ." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null })
    .eq("id", user.id);

  if (profileError) return { ok: false, message: profileError.message };

  const { error: authError } = await supabase.auth.updateUser({ data: { full_name: fullName } });
  if (authError) {
    return { ok: false, message: "Hồ sơ đã cập nhật nhưng chưa thể đồng bộ tên đăng nhập. Vui lòng thử lại." };
  }

  revalidatePath("/");
  revalidatePath("/account");
  return { ok: true, message: "Đã cập nhật thông tin tài khoản." };
}

