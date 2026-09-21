import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { APP_ROLES, isAppRole, type AppRole } from "./roles";

async function readAuthenticatedUser() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return { supabase, user: null, role: null, fullName: null };

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  return {
    supabase,
    user,
    role: isAppRole(profile?.role) ? profile.role : null,
    fullName: profile?.full_name?.trim() || null,
  };
}

export async function getCurrentAuth(): Promise<{ user: User | null; role: AppRole | null; fullName: string | null }> {
  if (!hasSupabaseEnv()) return { user: null, role: null, fullName: null };
  const { user, role, fullName } = await readAuthenticatedUser();
  return { user, role, fullName };
}

export async function requirePageRole(allowedRoles: readonly AppRole[], pathname: string) {
  if (!hasSupabaseEnv()) {
    redirect(`/login?message=${encodeURIComponent("Supabase chưa được cấu hình")}`);
  }

  const auth = await readAuthenticatedUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent(pathname)}`);
  if (!auth.role || !allowedRoles.includes(auth.role)) {
    redirect(`/forbidden?from=${encodeURIComponent(pathname)}`);
  }

  return { ...auth, user: auth.user, role: auth.role };
}

export async function requireAuthenticatedPage(pathname: string) {
  return requirePageRole(APP_ROLES, pathname);
}

export async function requireActionRole(allowedRoles: readonly AppRole[]) {
  if (!hasSupabaseEnv()) throw new Error("Supabase chưa được cấu hình.");

  const auth = await readAuthenticatedUser();
  if (!auth.user) throw new Error("Chưa đăng nhập.");
  if (!auth.role || !allowedRoles.includes(auth.role)) {
    throw new Error("Bạn không có quyền thực hiện thao tác này.");
  }

  return { ...auth, user: auth.user, role: auth.role };
}
