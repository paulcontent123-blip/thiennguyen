import { AccountPortal } from "@/components/account/account-portal";
import { SiteHeader } from "@/components/site-header";
import { requireAuthenticatedPage } from "@/lib/auth/server";

export default async function AccountPage() {
  const { supabase, user, role, fullName } = await requireAuthenticatedPage("/account");
  const { data: profile } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <AccountPortal
        email={user.email ?? ""}
        fullName={fullName || user.email?.split("@")[0] || "Tài khoản"}
        phone={profile?.phone ?? ""}
        role={role}
      />
    </main>
  );
}
