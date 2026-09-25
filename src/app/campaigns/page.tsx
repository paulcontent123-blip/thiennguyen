import Link from "next/link";
import { redirect } from "next/navigation";
import { CampaignCard } from "@/components/campaign-card";
import { SiteHeader } from "@/components/site-header";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/categories";
import { getCampaignFollowStates, type CampaignFollowState } from "@/lib/campaigns/follows";
import { PROVINCES } from "@/lib/geo/provinces";
import { getPublicCampaigns, type PublicCampaign } from "@/lib/public-data";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 9;
type SearchParams = Record<string, string | string[] | undefined>;

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
  const province = firstParam(searchParams.province);
  const type = firstParam(searchParams.type);
  const owner = firstParam(searchParams.owner);

  if (query) params.set("q", query);
  if (category) params.set("category", category);
  if (province) params.set("province", province);
  if (type) params.set("type", type);
  if (owner) params.set("owner", owner);
  if (page > 1) params.set("page", String(page));

  const queryString = params.toString();
  return queryString ? `/campaigns?${queryString}` : "/campaigns";
}

export default async function CampaignsPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const requestedPage = getPage(firstParam(searchParams.page));
  const campaignResult = await getPublicCampaigns({
    query: firstParam(searchParams.q) ?? "",
    category: firstParam(searchParams.category) ?? "",
    province: firstParam(searchParams.province) ?? "",
    type: firstParam(searchParams.type) ?? "",
    owner: firstParam(searchParams.owner) ?? "",
    page: requestedPage,
  });
  const { campaigns, total, stale, error: dataError } = campaignResult;
  let viewer: "guest" | "donor" | "other" = "guest";
  let followStates: Record<string, CampaignFollowState> = {};
  if (hasSupabaseEnv()) {
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      const { data: profile } = authData.user
        ? await supabase.from("profiles").select("role").eq("id", authData.user.id).maybeSingle()
        : { data: null };
      viewer = !authData.user ? "guest" : profile?.role === "donor" ? "donor" : "other";
      followStates = await getCampaignFollowStates(
        supabase,
        campaigns.map((campaign) => campaign.id),
        viewer === "donor" ? authData.user?.id : undefined,
      );
    } catch (authError) {
      console.warn("Campaign viewer data unavailable", authError);
    }
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (requestedPage > totalPages) {
    redirect(buildPageHref(searchParams, totalPages));
  }

  const query = firstParam(searchParams.q) ?? "";
  const selectedCategory = firstParam(searchParams.category) ?? "";
  const selectedProvince = firstParam(searchParams.province) ?? "";
  const selectedType = firstParam(searchParams.type) ?? "";
  const selectedOwner = firstParam(searchParams.owner) ?? "";

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

        {dataError ? (
          <div role="status" className="mt-5 rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {stale ? "Đang dùng dữ liệu dự phòng. " : ""}{dataError}
          </div>
        ) : null}

        <form className="mt-8 grid gap-3 rounded-[14px] border border-line bg-white p-4 md:grid-cols-[minmax(0,1fr)_170px_170px_150px_150px_auto]">
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
          <label className="sr-only" htmlFor="campaign-province">Tỉnh/thành</label>
          <select
            id="campaign-province"
            name="province"
            defaultValue={selectedProvince}
            className="h-11 rounded-[8px] border border-lineStrong bg-paper px-3 text-sm text-chamDeep outline-none focus:border-son"
          >
            <option value="">Tất cả tỉnh/thành</option>
            {PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
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
          <label className="sr-only" htmlFor="campaign-owner">Chủ sở hữu</label>
          <select
            id="campaign-owner"
            name="owner"
            defaultValue={selectedOwner}
            className="h-11 rounded-[8px] border border-lineStrong bg-paper px-3 text-sm text-chamDeep outline-none focus:border-son"
          >
            <option value="">Tất cả chủ sở hữu</option>
            <option value="organization">Tổ chức</option>
            <option value="individual">Cá nhân đã xác minh</option>
          </select>
          <button type="submit" className="button-primary h-11">Lọc chiến dịch</button>
        </form>

        {campaigns.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} follow={{ state: followStates[campaign.id] ?? { count: 0, followed: false }, viewer }} />
            ))}
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
