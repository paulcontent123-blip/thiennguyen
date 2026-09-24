import { DonateItemsPortal, type ManagedCampaign, type ResourceClaim, type ResourceNeed, type ResourceOffer } from "@/components/donate-items/donate-items-portal";
import { SiteHeader } from "@/components/site-header";
import { getCurrentAuth } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function DonateItemsPage() {
  const supabase = createClient();
  const auth = await getCurrentAuth();
  const [needsResult, offersResult] = await Promise.all([
    supabase.rpc("get_public_resource_needs"),
    supabase.rpc("get_public_resource_offers"),
  ]);

  const publicNeeds = (needsResult.data ?? []) as ResourceNeed[];
  const publicOffers = (offersResult.data ?? []) as ResourceOffer[];
  const loadError = needsResult.error || offersResult.error
    ? "Chưa đọc được dữ liệu nguồn lực. Hãy bảo đảm các migration nguồn lực 202609240006 và 202609240010 đã được áp dụng."
    : null;

  let ownOffers: ResourceOffer[] = [];
  let ownClaims: ResourceClaim[] = [];
  let managedCampaigns: ManagedCampaign[] = [];

  if (auth.user) {
    const [ownOffersResult, ownClaimsResult] = await Promise.all([
      supabase
        .from("resource_offers")
        .select("id, resource_type, title, description, quantity, unit, estimated_value_vnd, province, available_from, radius_km, status, created_at, matched_need_id, contact_name, contact_email, contact_phone")
        .eq("user_id", auth.user.id)
        .eq("owner_hidden", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("resource_claims")
        .select("id, need_id, offer_id, quantity, status, expires_at, coordination_note, actual_value_vnd, confirmed_at, created_at, resource_needs(name, unit, campaigns(title, slug))")
        .eq("contributor_id", auth.user.id)
        .eq("owner_hidden", false)
        .order("created_at", { ascending: false }),
    ]);
    ownOffers = (ownOffersResult.data ?? []) as ResourceOffer[];
    ownClaims = ((ownClaimsResult.data ?? []) as unknown[]).map((row) => {
      const item = row as Record<string, unknown>;
      const need = relation(item.resource_needs as { name: string; unit: string; campaigns: { title: string; slug: string } | { title: string; slug: string }[] | null } | null);
      const campaign = relation(need?.campaigns);
      return {
        id: String(item.id),
        need_id: String(item.need_id),
        offer_id: item.offer_id ? String(item.offer_id) : null,
        quantity: Number(item.quantity),
        status: String(item.status),
        expires_at: item.expires_at ? String(item.expires_at) : null,
        coordination_note: item.coordination_note ? String(item.coordination_note) : null,
        actual_value_vnd: item.actual_value_vnd === null ? null : Number(item.actual_value_vnd),
        confirmed_at: item.confirmed_at ? String(item.confirmed_at) : null,
        created_at: String(item.created_at),
        need_name: need?.name ?? "Nhu cầu nguồn lực",
        need_unit: need?.unit ?? "đơn vị",
        campaign_title: campaign?.title ?? "Chiến dịch",
        campaign_slug: campaign?.slug ?? null,
      };
    });

    if (auth.role === "admin") {
      const { data } = await supabase.from("campaigns").select("id, title, slug, status, province").in("status", ["approved", "active"]).order("created_at", { ascending: false });
      managedCampaigns = (data ?? []) as ManagedCampaign[];
    } else if (auth.role === "donor") {
      const { data } = await supabase.from("campaigns").select("id, title, slug, status, province").eq("owner_type", "individual").eq("owner_user_id", auth.user.id).in("status", ["approved", "active"]).order("created_at", { ascending: false });
      managedCampaigns = (data ?? []) as ManagedCampaign[];
    } else if (auth.role === "org") {
      const { data: organization } = await supabase.from("organizations").select("id").eq("user_id", auth.user.id).maybeSingle();
      if (organization) {
        const { data } = await supabase.from("campaigns").select("id, title, slug, status, province").eq("organization_id", organization.id).in("status", ["approved", "active"]).order("created_at", { ascending: false });
        managedCampaigns = (data ?? []) as ManagedCampaign[];
      }
    }

  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <DonateItemsPortal
        isAuthenticated={Boolean(auth.user)}
        role={auth.role}
        defaultName={auth.fullName ?? ""}
        defaultEmail={auth.user?.email ?? ""}
        publicNeeds={publicNeeds}
        publicOffers={publicOffers}
        ownOffers={ownOffers}
        ownClaims={ownClaims}
        managedCampaigns={managedCampaigns}
        loadError={loadError}
      />
    </main>
  );
}
