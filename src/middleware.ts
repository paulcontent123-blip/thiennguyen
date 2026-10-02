import { NextResponse, type NextRequest } from "next/server";
import { allowedRolesForPath } from "@/lib/auth/permissions";
import { isAppRole } from "@/lib/auth/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const allowedRoles = allowedRolesForPath(request.nextUrl.pathname);

  if (!hasSupabaseEnv()) {
    if (allowedRoles) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("message", "Supabase chưa được cấu hình");
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Khách chưa có phiên đăng nhập không cần một round-trip tới Supabase trên
  // mọi trang công khai. Route được bảo vệ vẫn luôn xác thực ở phía server.
  const hasAuthCookie = request.cookies.getAll().some(({ name }) =>
    name.startsWith("sb-") && name.includes("-auth-token")
  );
  if (!allowedRoles && !hasAuthCookie) return NextResponse.next();

  const { response, supabase, user } = await updateSession(request);
  if (!allowedRoles) return response;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAppRole(profile?.role) || !allowedRoles.includes(profile.role)) {
    const forbiddenUrl = new URL("/forbidden", request.url);
    forbiddenUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(forbiddenUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
