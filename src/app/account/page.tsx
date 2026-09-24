import Link from "next/link";
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

type FollowRow = {
  campaign_id: string;
  created_at: string;
  campaigns: { slug: string; title: string; status: string } | { slug: string; title: string; status: string }[] | null;
};

export default async function AccountPage() {
  const { supabase, user, role, fullName } = await requireAuthenticatedPage("/account");
  const [profileResult, transactionResult, followsResult] = await Promise.all([
    supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
    supabase
      .from("transactions")
      .select("id, tx_ref, amount_vnd, status, created_at, completed_at, campaigns(title, slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("campaign_follows")
      .select("campaign_id, created_at, campaigns(slug, title, status)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (transactionResult.error) {
    console.warn("Donation history is unavailable", { userId: user.id, code: transactionResult.error.code });
  }
  if (followsResult.error) {
    console.warn("Followed campaign list is unavailable", { userId: user.id, code: followsResult.error.code });
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
  const followedCampaigns = ((followsResult.data ?? []) as unknown as FollowRow[]).flatMap((row) => {
    const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns;
    return campaign ? [{ ...campaign, id: row.campaign_id }] : [];
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
      {role === "donor" ? (
        <section className="mx-auto max-w-5xl px-6 pb-12">
          <div className="panel">
            <h2 className="font-serif text-xl font-semibold text-chamDeep">Chiến dịch đang theo dõi</h2>
            <p className="mt-1 text-sm text-inkSoft">Những chiến dịch bạn đã lưu để xem lại.</p>
            {followedCampaigns.length ? (
              <ul className="mt-5 divide-y divide-line">
                {followedCampaigns.map((campaign) => (
                  <li key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <Link href={`/campaigns/${encodeURIComponent(campaign.slug)}`} className="font-semibold text-chamDeep hover:text-son">{campaign.title}</Link>
                    <span className="text-xs text-inkSoft">{campaign.status === "active" ? "Đang hoạt động" : campaign.status === "closed" ? "Đã đóng" : "Đã duyệt"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-inkSoft">Bạn chưa theo dõi chiến dịch nào. <Link href="/campaigns" className="font-semibold text-sky hover:underline">Khám phá chiến dịch →</Link></p>}
          </div>
        </section>
      ) : null}
    </main>
  );
}
