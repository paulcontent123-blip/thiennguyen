import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthenticatedDestination } from "@/lib/auth/destination";
import { isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

function redirectToLogin(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedPath = request.nextUrl.searchParams.get("next");

  if (!code) return redirectToLogin(request, "Liên kết xác thực không hợp lệ hoặc đã hết hạn.");

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return redirectToLogin(request, "Không thể hoàn tất xác thực. Vui lòng thử lại.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !isAppRole(profile?.role)) {
    await supabase.auth.signOut();
    return redirectToLogin(request, "Đã xác thực email nhưng không thể xác định quyền tài khoản.");
  }

  const destination = resolveAuthenticatedDestination(profile.role, requestedPath);
  return NextResponse.redirect(new URL(destination, request.url));
}
