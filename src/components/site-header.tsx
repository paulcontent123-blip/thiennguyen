import Link from "next/link";
import { Suspense } from "react";
import { AuthControls } from "./auth-controls";
import { CreateCampaignModal } from "./create-campaign-modal";
import { MobileNav } from "./mobile-nav";
import { getCurrentAuth } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const navLinks = [
  ["Tin tức", "/news"],
  ["Ủng hộ", "/"],
  ["Khám phá", "/campaigns"],
  ["Bản đồ SOS", "/sos"],
  ["Nguồn lực", "/donate-items"],
  ["Minh bạch", "/transparency"],
  ["Đồng hành cùng quỹ", "/corporate"],
  ["Giới thiệu", "/introduction"],
] as const;

export async function SiteHeader() {
  const { user, role, fullName } = await getCurrentAuth();
  const username = fullName || String(user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Tài khoản");
  const roleLabel = role
    ? { donor: "Nhà hảo tâm", org: "Tổ chức", rescue_team: "Đội cứu trợ", admin: "Quản trị viên" }[role]
    : undefined;
  let canCreateCampaign = false;
  if (role === "org" && user) {
    const supabase = createClient();
    const { data: organization } = await supabase
      .from("organizations")
      .select("license_status")
      .eq("user_id", user.id)
      .maybeSingle();
    canCreateCampaign = organization?.license_status === "approved";
  }
  const roleLinks = [
    ...(role && role !== "admin" ? [["Tin tức", "/news"]] : []),
    ...(role === "org" ? [["Quản lý tổ chức", "/organization"]] : []),
    ...(role === "donor" || role === "org" ? [["Ví của tôi", "/wallet"]] : []),
    ...(role === "donor" ? [["Chiến dịch cá nhân", "/personal-campaigns"]] : []),
    ...(role === "rescue_team" || role === "admin" ? [["Điều phối cứu trợ", "/rescue/operations"]] : []),
    ...(role === "admin" ? [["Admin", "/admin"]] : []),
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <nav className="relative mx-auto flex max-w-[1160px] items-center gap-3 px-4 py-3 md:gap-6 md:px-7 md:py-3.5">
        <Link href="/" className="flex items-center gap-2 whitespace-nowrap font-serif text-lg font-semibold text-chamDeep">
          <span className="text-xl">&#10084;</span> Thiện Nguyện
        </Link>
        <div className="hidden flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-[13px] font-bold text-inkMid md:flex">
          {navLinks.map(([label, href]) => (
            <Link key={href} href={href} className="transition hover:text-son">
              {label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0 md:gap-2.5">
          <Suspense fallback={<div className="h-[38px] w-[92px]" />}>
            <AuthControls
              isAuthenticated={Boolean(user)}
              email={user?.email ?? undefined}
              username={username}
              roleLabel={roleLabel}
              roleLinks={roleLinks}
            />
          </Suspense>
          {canCreateCampaign ? <CreateCampaignModal /> : null}
          <MobileNav links={navLinks} />
        </div>
      </nav>
    </header>
  );
}
