import { PersonalCampaignDashboard } from "@/components/personal-campaigns/personal-campaign-dashboard";
import { SiteHeader } from "@/components/site-header";
import { requirePageRole } from "@/lib/auth/server";
import { redirect } from "next/navigation";

const PAGE_SIZE = 8;

export default async function PersonalCampaignsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const { supabase, user } = await requirePageRole(["donor"], "/personal-campaigns");
  const requestedPage = Number.parseInt(searchParams?.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [{ data: profile, error: profileError }, campaignsResult] = await Promise.all([
    supabase
      .from("personal_profiles")
      .select("user_id, legal_name, phone, verification_status, verification_document_path, verification_note, verified_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("campaigns")
      .select("id, slug, title, description, campaign_type, category, province, target_amount, deadline, status, review_note, submitted_at, created_at", { count: "exact" })
      .eq("owner_type", "individual")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ]);

  if (profileError) throw new Error(profileError.message);
  if (campaignsResult.error) throw new Error(campaignsResult.error.message);

  const campaigns = campaignsResult.data ?? [];
  const total = campaignsResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > totalPages) redirect(`/personal-campaigns?page=${totalPages}`);

  const campaignIds = campaigns.map((campaign) => campaign.id);
  const { data: history, error: historyError } = campaignIds.length
    ? await supabase
        .from("campaign_status_history")
        .select("id, campaign_id, from_status, to_status, actor_name, actor_role, note, created_at")
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (historyError) throw new Error(historyError.message);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <PersonalCampaignDashboard
        profile={profile ?? null}
        campaigns={campaigns}
        history={history ?? []}
        page={page}
        total={total}
        totalPages={totalPages}
      />
    </main>
  );
}
