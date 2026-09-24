import { OrganizationDashboard } from "@/components/organization/organization-dashboard";
import type { ManagedCampaign, ManagedClaim, ResourceNeed, ResourceOffer } from "@/components/donate-items/donate-items-portal";
import { SiteHeader } from "@/components/site-header";
import { requirePageRole } from "@/lib/auth/server";
import { redirect } from "next/navigation";

const PAGE_SIZE = 8;

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function OrganizationPage({ searchParams }: { searchParams?: { page?: string } }) {
  const { supabase, user } = await requirePageRole(["org"], "/organization");
  const requestedPage = Number.parseInt(searchParams?.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, avatar_url, legal_representative_name, legal_representative_email, legal_representative_phone, license_status, license_file_path, license_number, license_note, verified_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (organizationError || !organization) throw new Error("Không tìm thấy hồ sơ tổ chức gắn với tài khoản này.");

  const from = (page - 1) * PAGE_SIZE;
  const { data: campaigns, count } = await supabase
    .from("campaigns")
    .select("id, title, summary, description, campaign_type, category, province, target_amount, deadline, status, review_note, submitted_at, created_at", { count: "exact" })
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > totalPages) redirect(`/organization?page=${totalPages}`);
  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);
  const { data: history } = campaignIds.length
    ? await supabase
        .from("campaign_status_history")
        .select("id, campaign_id, from_status, to_status, actor_name, actor_role, note, created_at")
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: resourceCampaignRows } = await supabase
    .from("campaigns")
    .select("id, title, slug, status, province")
    .eq("organization_id", organization.id)
    .in("status", ["approved", "active"])
    .order("created_at", { ascending: false });
  const resourceCampaigns = (resourceCampaignRows ?? []) as ManagedCampaign[];
  const resourceCampaignIds = resourceCampaigns.map((campaign) => campaign.id);
  const [publicNeedsResult, availableOffersResult, managedNeedsResult] = await Promise.all([
    supabase.rpc("get_public_resource_needs"),
    supabase.rpc("get_public_resource_offers"),
    resourceCampaignIds.length
      ? supabase
          .from("resource_needs")
          .select("id, campaign_id, resource_type, name, description, category, quantity_needed, unit, province, urgency, status, created_at, campaigns(title, slug, province)")
          .in("campaign_id", resourceCampaignIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const publicNeeds = (publicNeedsResult.data ?? []) as ResourceNeed[];
  const resourceNeeds = ((managedNeedsResult.data ?? []) as unknown[]).map((row) => {
    const item = row as Record<string, unknown>;
    const campaign = relation(item.campaigns as { title: string; slug: string; province: string | null } | { title: string; slug: string; province: string | null }[] | null);
    const publicNeed = publicNeeds.find((need) => need.id === item.id);
    return {
      id: String(item.id),
      campaign_id: String(item.campaign_id),
      resource_type: String(item.resource_type) as ResourceNeed["resource_type"],
      name: String(item.name),
      description: String(item.description ?? ""),
      category: item.category ? String(item.category) : null,
      quantity_needed: Number(item.quantity_needed),
      unit: String(item.unit),
      province: item.province ? String(item.province) : null,
      urgency: String(item.urgency) as ResourceNeed["urgency"],
      status: String(item.status),
      created_at: String(item.created_at),
      campaign_title: campaign?.title ?? "Chiến dịch",
      campaign_slug: campaign?.slug ?? "",
      campaign_province: campaign?.province ?? null,
      claimed_quantity: Number(publicNeed?.claimed_quantity ?? 0),
    } satisfies ResourceNeed;
  });

  let resourceClaims: ManagedClaim[] = [];
  const resourceNeedIds = resourceNeeds.map((need) => need.id);
  if (resourceNeedIds.length > 0) {
    const { data: claims } = await supabase
      .from("resource_claims")
      .select("id, need_id, offer_id, contributor_id, quantity, contact_name, contact_email, contact_phone, status, expires_at, coordination_note, actual_value_vnd, created_at, resource_needs(name, unit)")
      .in("need_id", resourceNeedIds)
      .order("created_at", { ascending: false });
    resourceClaims = ((claims ?? []) as unknown[]).map((row) => {
      const item = row as Record<string, unknown>;
      const need = relation(item.resource_needs as { name: string; unit: string } | { name: string; unit: string }[] | null);
      return {
        id: String(item.id),
        need_id: String(item.need_id),
        offer_id: item.offer_id ? String(item.offer_id) : null,
        contributor_id: String(item.contributor_id),
        quantity: Number(item.quantity),
        contact_name: String(item.contact_name),
        contact_email: String(item.contact_email),
        contact_phone: item.contact_phone ? String(item.contact_phone) : null,
        status: String(item.status),
        expires_at: item.expires_at ? String(item.expires_at) : null,
        coordination_note: item.coordination_note ? String(item.coordination_note) : null,
        actual_value_vnd: item.actual_value_vnd === null ? null : Number(item.actual_value_vnd),
        created_at: String(item.created_at),
        need_name: need?.name ?? "Nhu cầu nguồn lực",
        need_unit: need?.unit ?? "đơn vị",
      };
    });
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <OrganizationDashboard
        organization={organization}
        campaigns={campaigns ?? []}
        history={history ?? []}
        page={Math.min(page, totalPages)}
        total={total}
        totalPages={totalPages}
        resourceCampaigns={resourceCampaigns}
        resourceNeeds={resourceNeeds}
        resourceClaims={resourceClaims}
        availableResourceOffers={(availableOffersResult.data ?? []) as ResourceOffer[]}
      />
    </main>
  );
}
