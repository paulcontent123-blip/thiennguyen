import { NextResponse, type NextRequest } from "next/server";
import { allowedRolesForPath } from "@/lib/auth/permissions";
import { isAppRole } from "@/lib/auth/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const allowedRoles = allowedRolesForPath(request.nextUrl.pathname);

  if (!hasSupabaseEnv()) {
    if (allowedRoles) {
      return NextResponse.redirect(new URL("/login?message=Supabase%20chưa%20được%20cấu%20hình", request.url));
    }
    return NextResponse.next();
  }

  const { response, supabase, user } = await updateSession(request);
  if (!allowedRoles) return response;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAppRole(profile?.role) || !allowedRoles.includes(profile.role)) {
    return NextResponse.redirect(new URL("/?error=forbidden", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
