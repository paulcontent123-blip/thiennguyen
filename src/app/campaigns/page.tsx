import Link from "next/link";
import { redirect } from "next/navigation";
import { CampaignCard, type CampaignCardData } from "@/components/campaign-card";
import { SiteHeader } from "@/components/site-header";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/categories";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 9;
const PUBLIC_STATUSES = ["approved", "active", "closed"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

type PublicCampaign = CampaignCardData & {
  id: string;
  campaignType: string;
  category: string | null;
  status: string;
  publishedAt: string | null;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function buildPageHref(searchParams: SearchParams, page: number) {
  const params = new URLSearchParams();
  const query = firstParam(searchParams.q)?.trim();
  const category = firstParam(searchParams.category);
  const type = firstParam(searchParams.type);

  if (query) params.set("q", query);
  if (category) params.set("category", category);
  if (type) params.set("type", type);
  if (page > 1) params.set("page", String(page));

  const queryString = params.toString();
  return queryString ? `/campaigns?${queryString}` : "/campaigns";
}

async function getPublicCampaigns(searchParams: SearchParams, page: number) {
  if (!hasSupabaseEnv()) {
    return { campaigns: [] as PublicCampaign[], total: 0 };
  }

  const supabase = createClient();
  const query = firstParam(searchParams.q)?.replace(/[%,]/g, "").trim().slice(0, 80);
  const category = firstParam(searchParams.category);
  const type = firstParam(searchParams.type);
  const from = (page - 1) * PAGE_SIZE;

  let campaignsQuery = supabase
    .from("campaigns")
    .select(
      "id, organization_id, slug, title, summary, target_amount, campaign_type, category, status, published_at, created_at",
      { count: "exact" },
    )
    .in("status", [...PUBLIC_STATUSES])
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (query) campaignsQuery = campaignsQuery.ilike("title", `%${query}%`);
  if (category && CAMPAIGN_CATEGORIES.includes(category as (typeof CAMPAIGN_CATEGORIES)[number])) {
    campaignsQuery = campaignsQuery.eq("category", category);
  }
  if (type === "direct" || type === "partner") {
    campaignsQuery = campaignsQuery.eq("campaign_type", type);
  }

  const { data, count, error } = await campaignsQuery;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const organizationIds = Array.from(new Set(rows.map((campaign) => campaign.organization_id)));
  const { data: organizations, error: organizationError } = organizationIds.length
    ? await supabase.from("organizations").select("id, name").in("id", organizationIds)
    : { data: [], error: null };

  if (organizationError) throw new Error(organizationError.message);

  const organizationNames = new Map((organizations ?? []).map((organization) => [organization.id, organization.name]));
  const campaigns = rows.map((campaign) => ({
    id: campaign.id,
    slug: campaign.slug,
    title: campaign.title,
    summary: campaign.summary,
    targetAmount: Number(campaign.target_amount),
    organizationName: organizationNames.get(campaign.organization_id) ?? "Tổ chức thiện nguyện",
    campaignType: campaign.campaign_type,
    category: campaign.category,
    status: campaign.status,
    publishedAt: campaign.published_at,
  }));

  return { campaigns, total: count ?? 0 };
}

export default async function CampaignsPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const requestedPage = getPage(firstParam(searchParams.page));
  const { campaigns, total } = await getPublicCampaigns(searchParams, requestedPage);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (requestedPage > totalPages) {
    redirect(buildPageHref(searchParams, totalPages));
  }

  const query = firstParam(searchParams.q) ?? "";
  const selectedCategory = firstParam(searchParams.category) ?? "";
  const selectedType = firstParam(searchParams.type) ?? "";

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-[1160px] px-7 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Khám phá</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-chamDeep">Chiến dịch đang kết nối</h1>
            <p className="mt-3 max-w-2xl leading-7 text-inkMid">
              Các chiến dịch đã được Admin phê duyệt và đang công khai trên nền tảng.
            </p>
          </div>
          <span className="rounded-full bg-luaSoft px-3 py-1.5 text-sm font-bold text-lua">{total} chiến dịch</span>
        </div>

        <form className="mt-8 grid gap-3 rounded-[14px] border border-line bg-white p-4 md:grid-cols-[minmax(0,1fr)_180px_170px_auto]">
          <label className="sr-only" htmlFor="campaign-search">Tìm kiếm chiến dịch</label>
          <input
            id="campaign-search"
            name="q"
            defaultValue={query}
            placeholder="Tìm theo tên chiến dịch"
            className="h-11 rounded-[8px] border border-lineStrong bg-paper px-3 text-sm text-chamDeep outline-none focus:border-son"
          />
          <label className="sr-only" htmlFor="campaign-category">Hạng mục</label>
          <select
            id="campaign-category"
            name="category"
            defaultValue={selectedCategory}
            className="h-11 rounded-[8px] border border-lineStrong bg-paper px-3 text-sm text-chamDeep outline-none focus:border-son"
          >
            <option value="">Tất cả hạng mục</option>
            {CAMPAIGN_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <label className="sr-only" htmlFor="campaign-type">Loại chiến dịch</label>
          <select
            id="campaign-type"
            name="type"
            defaultValue={selectedType}
            className="h-11 rounded-[8px] border border-lineStrong bg-paper px-3 text-sm text-chamDeep outline-none focus:border-son"
          >
            <option value="">Tất cả loại</option>
            <option value="direct">Trực tiếp</option>
            <option value="partner">Kết nối</option>
          </select>
          <button type="submit" className="button-primary h-11">Lọc chiến dịch</button>
        </form>

        {campaigns.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
          </div>
        ) : (
          <div className="mt-8 rounded-[14px] border-2 border-dashed border-lineStrong bg-paperMid p-12 text-center">
            <div className="text-5xl">🏛️</div>
            <h2 className="mt-4 font-serif text-2xl font-semibold text-chamDeep">Chưa tìm thấy chiến dịch</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-inkMid">
              Thử thay đổi từ khóa hoặc bộ lọc. Chiến dịch chỉ xuất hiện sau khi được Admin phê duyệt và công khai.
            </p>
            <Link href="/campaigns" className="button-secondary mt-5 inline-flex">Xóa bộ lọc</Link>
          </div>
        )}

        {totalPages > 1 ? (
          <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Phân trang chiến dịch">
            {requestedPage > 1 ? (
              <Link href={buildPageHref(searchParams, requestedPage - 1)} className="rounded-[8px] border border-lineStrong px-3 py-2 text-sm font-bold text-chamDeep hover:border-son hover:text-son">Trước</Link>
            ) : null}
            <span className="px-3 text-sm text-inkMid">Trang {requestedPage}/{totalPages}</span>
            {requestedPage < totalPages ? (
              <Link href={buildPageHref(searchParams, requestedPage + 1)} className="rounded-[8px] border border-lineStrong px-3 py-2 text-sm font-bold text-chamDeep hover:border-son hover:text-son">Sau</Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
