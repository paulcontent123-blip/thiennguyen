import { AccountPortal } from "@/components/account/account-portal";
import { DonationHistory } from "@/components/account/donation-history";
import { SiteHeader } from "@/components/site-header";
import { requireAuthenticatedPage } from "@/lib/auth/server";
import type { DonationHistoryItem } from "@/lib/donations/types";

type DonationRow = {
  id: string;
  tx_ref: string;
  amount_vnd: number | string;
  status: string;
  created_at: string;
  completed_at: string | null;
  campaigns: { title: string; slug: string } | { title: string; slug: string }[] | null;
};

export default async function AccountPage() {
  const { supabase, user, role, fullName } = await requireAuthenticatedPage("/account");
  const [profileResult, transactionResult] = await Promise.all([
    supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
    supabase
      .from("transactions")
      .select("id, tx_ref, amount_vnd, status, created_at, completed_at, campaigns(title, slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (transactionResult.error) {
    console.warn("Donation history is unavailable", { userId: user.id, code: transactionResult.error.code });
  }

  const transactions = ((transactionResult.data ?? []) as unknown as DonationRow[]).flatMap<DonationHistoryItem>((row) => {
    const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns;
    if (!campaign) return [];
    return [{
      id: row.id,
      txRef: row.tx_ref,
      amountVnd: Number(row.amount_vnd) || 0,
      status: row.status,
      campaignTitle: campaign.title,
      campaignSlug: campaign.slug,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }];
  });

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <AccountPortal
        email={user.email ?? ""}
        fullName={fullName || user.email?.split("@")[0] || "Tài khoản"}
        phone={profileResult.data?.phone ?? ""}
        role={role}
      />
      <DonationHistory items={transactions} />
    </main>
  );
}
