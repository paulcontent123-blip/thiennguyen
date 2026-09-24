import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CampaignCard } from "@/components/campaign-card";
import { SiteHeader } from "@/components/site-header";
import { getCampaignFollowStates } from "@/lib/campaigns/follows";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 9;
const PUBLIC_STATUSES = ["approved", "active", "closed"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function PublicOrganizationPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { page?: string };
}) {
  if (!hasSupabaseEnv() || !UUID_PATTERN.test(params.id)) notFound();

  const supabase = createClient();
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, avatar_url, verified_at, license_status")
    .eq("id", params.id)
    .eq("license_status", "approved")
    .maybeSingle();

  if (organizationError) throw new Error(organizationError.message);
  if (!organization) notFound();

  const requestedPage = Number.parseInt(searchParams?.page ?? "1", 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const from = (page - 1) * PAGE_SIZE;

  const [campaignResult, activeResult, authResult] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, slug, title, summary, target_amount, campaign_type, category, province, status", { count: "exact" })
      .eq("organization_id", organization.id)
      .eq("owner_type", "organization")
      .in("status", [...PUBLIC_STATUSES])
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("owner_type", "organization")
      .eq("status", "active"),
    supabase.auth.getUser(),
  ]);

  if (campaignResult.error) throw new Error(campaignResult.error.message);
  if (activeResult.error) throw new Error(activeResult.error.message);

  const total = campaignResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > totalPages) redirect(`/organizations/${organization.id}?page=${totalPages}`);

  const rows = campaignResult.data ?? [];
  const ids = rows.map((campaign) => campaign.id);
  const [mediaResult, profileResult] = await Promise.all([
    ids.length
      ? supabase
          .from("campaign_media")
          .select("campaign_id, url")
          .in("campaign_id", ids)
          .eq("media_type", "cover")
          .eq("is_public", true)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    authResult.data.user
      ? supabase.from("profiles").select("role").eq("id", authResult.data.user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (mediaResult.error) throw new Error(mediaResult.error.message);

  const viewer = !authResult.data.user ? "guest" : profileResult.data?.role === "donor" ? "donor" : "other";
  const followStates = await getCampaignFollowStates(supabase, ids, viewer === "donor" ? authResult.data.user?.id : undefined);
  const covers = new Map<string, string>();
  for (const item of mediaResult.data ?? []) {
    if (!covers.has(item.campaign_id)) covers.set(item.campaign_id, item.url);
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-[1160px] px-7 py-10">
        <nav className="mb-6 text-xs text-inkSoft" aria-label="Đường dẫn">
          <Link href="/campaigns" className="text-sky hover:underline">Chiến dịch</Link>
          <span className="px-2">›</span>
          <span>Tổ chức</span>
        </nav>

        <div className="rounded-[14px] border border-line bg-white p-6 shadow-card sm:p-8">
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sonSoft text-3xl font-bold text-son">
              {organization.avatar_url ? <Image src={organization.avatar_url} alt={`Ảnh đại diện ${organization.name}`} fill unoptimized className="object-cover" /> : organization.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="eyebrow">Hồ sơ tổ chức công khai</p>
              <h1 className="mt-1 font-serif text-3xl font-semibold text-chamDeep">{organization.name}</h1>
              <p className="mt-2 text-sm font-semibold text-lua">✓ Đã xác minh giấy phép hoạt động</p>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-inkMid">
            Hồ sơ này chỉ hiển thị thông tin tổ chức đã được duyệt và những chiến dịch đang công khai. Giấy phép, thông tin liên hệ của người đại diện và dữ liệu nội bộ không được công khai.
          </p>
          <div className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-3">
            <div><div className="font-mono text-2xl font-bold text-son">{total}</div><div className="text-sm text-inkSoft">Chiến dịch công khai</div></div>
            <div><div className="font-mono text-2xl font-bold text-lua">{activeResult.count ?? 0}</div><div className="text-sm text-inkSoft">Đang hoạt động</div></div>
            <div><div className="font-mono text-lg font-bold text-chamDeep">{organization.verified_at ? dateFormatter.format(new Date(organization.verified_at)) : "Đã duyệt"}</div><div className="text-sm text-inkSoft">Ngày xác minh</div></div>
          </div>
        </div>

        <div className="mt-10 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Hoạt động công khai</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-chamDeep">Chiến dịch của tổ chức</h2>
          </div>
          <Link href="/campaigns" className="text-sm font-semibold text-sky hover:underline">Xem tất cả chiến dịch →</Link>
        </div>

        {rows.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={{
                  id: campaign.id,
                  slug: campaign.slug,
                  title: campaign.title,
                  summary: campaign.summary,
                  targetAmount: Number(campaign.target_amount) || 0,
                  campaignType: campaign.campaign_type,
                  category: campaign.category,
                  province: campaign.province,
                  status: campaign.status,
                  organizationName: organization.name,
                  coverUrl: covers.get(campaign.id),
                }}
                follow={{ state: followStates[campaign.id] ?? { count: 0, followed: false }, viewer }}
              />
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-[14px] border border-line bg-white p-8 text-sm text-inkMid">Tổ chức chưa có chiến dịch nào công khai.</p>
        )}

        {totalPages > 1 ? (
          <nav className="mt-8 flex items-center justify-center gap-4 text-sm" aria-label="Phân trang chiến dịch của tổ chức">
            {page > 1 ? <Link href={`/organizations/${organization.id}?page=${page - 1}`} className="button-secondary">Trước</Link> : null}
            <span>Trang {page}/{totalPages}</span>
            {page < totalPages ? <Link href={`/organizations/${organization.id}?page=${page + 1}`} className="button-secondary">Sau</Link> : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
