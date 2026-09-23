import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignContentManager } from "@/components/organization/campaign-content-manager";
import { SiteHeader } from "@/components/site-header";
import { requirePageRole } from "@/lib/auth/server";
import type { CampaignMedia, CampaignSeo, CampaignShareSettings, CampaignUpdate } from "@/lib/campaigns/content";

const statusLabels: Record<string, string> = {
  draft: "Bản nháp",
  pending_review: "Chờ duyệt",
  needs_revision: "Cần chỉnh sửa",
  approved: "Đã duyệt",
  active: "Đang hoạt động",
  closed: "Đã đóng",
  rejected: "Đã từ chối",
};

export default async function CampaignManagementPage({ params }: { params: { id: string } }) {
  const pathname = `/campaign-management/${params.id}`;
  const { supabase, user, role } = await requirePageRole(["donor", "org", "admin"], pathname);

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, organization_id, owner_type, owner_user_id, slug, title, status")
    .eq("id", params.id)
    .maybeSingle();

  if (campaignError || !campaign) notFound();

  if (role === "donor" && (campaign.owner_type !== "individual" || campaign.owner_user_id !== user.id)) notFound();
  if (role === "org") {
    const { data: organization } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", campaign.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!organization) notFound();
  }

  const [mediaResult, updatesResult, seoResult, shareResult] = await Promise.all([
    supabase
      .from("campaign_media")
      .select("id, campaign_id, update_id, media_type, slot, provider, title, alt_text, url, public_id, thumbnail_url, sort_order, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("campaign_updates")
      .select("id, campaign_id, update_type, title, body, location_text, event_at, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .order("event_at", { ascending: false }),
    supabase
      .from("campaign_seo")
      .select("campaign_id, meta_title, meta_description, canonical_url, schema_type, schema_json, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .maybeSingle(),
    supabase
      .from("campaign_share_settings")
      .select("campaign_id, zalo_enabled, facebook_enabled, copy_enabled, share_title, share_description, share_image_url, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .maybeSingle(),
  ]);

  if (mediaResult.error) throw new Error(mediaResult.error.message);
  if (updatesResult.error) throw new Error(updatesResult.error.message);
  if (seoResult.error) throw new Error(seoResult.error.message);
  if (shareResult.error) throw new Error(shareResult.error.message);

  const backHref = role === "admin" ? "/admin" : role === "org" ? `/organization/campaigns/${campaign.id}` : "/personal-campaigns";

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-[1160px] px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href={backHref} className="text-sm font-bold text-sky hover:underline">← Quay lại</Link>
            <p className="eyebrow mt-5">Quản lý nội dung & Viral Kit</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-chamDeep">{campaign.title}</h1>
            <p className="mt-2 text-sm text-inkMid">{statusLabels[campaign.status] ?? campaign.status} · {role === "admin" ? "Admin đang quản trị" : "Bạn là chủ chiến dịch"}</p>
          </div>
          {['approved', 'active', 'closed'].includes(campaign.status) ? <Link href={`/campaigns/${campaign.slug}`} className="rounded-full border border-lineStrong px-4 py-2 text-sm font-bold text-chamDeep hover:border-son hover:text-son">Xem trang công khai ↗</Link> : null}
        </div>

        {role !== "admin" && ['pending_review', 'rejected'].includes(campaign.status) ? (
          <div className="mt-8 rounded-[10px] border border-son/30 bg-son/10 p-4 text-sm text-son">{campaign.status === "pending_review" ? "Chiến dịch đang được Admin xét duyệt nên nội dung tạm thời bị khóa để tránh thay đổi hồ sơ trong lúc duyệt." : "Chiến dịch đã bị từ chối nên nội dung công khai không thể cập nhật."}</div>
        ) : (
          <CampaignContentManager
            campaignId={campaign.id}
            media={(mediaResult.data ?? []) as CampaignMedia[]}
            updates={(updatesResult.data ?? []) as CampaignUpdate[]}
            seo={(seoResult.data ?? null) as CampaignSeo | null}
            shareSettings={(shareResult.data ?? null) as CampaignShareSettings | null}
          />
        )}
      </section>
    </main>
  );
}
