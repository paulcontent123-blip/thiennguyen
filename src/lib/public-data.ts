import "server-only";

import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/categories";
import { PROVINCES } from "@/lib/geo/provinces";
import { getSupabaseEnv, hasSupabaseEnv } from "@/lib/supabase/env";
import type { NewsPost } from "@/lib/news/types";

const PAGE_SIZE = 9;
const PUBLIC_STATUSES = ["approved", "active", "closed"] as const;
const NEWS_SELECT = "id, slug, title, excerpt, content, category, tags, cover_url, status, author_id, published_at, created_at, updated_at, meta_title, meta_description, focus_keyword, canonical_url";

export type PublicCampaign = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  targetAmount: number;
  organizationName?: string;
  ownerType: string;
  campaignType: string;
  category: string | null;
  province: string | null;
  status: string;
  publishedAt: string | null;
};

type CampaignFilters = {
  query: string;
  category: string;
  province: string;
  type: string;
  owner: string;
  page: number;
};

type CampaignResult = { campaigns: PublicCampaign[]; total: number };
type NewsResult = { posts: NewsPost[] };

function publicSupabase() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function queryCampaigns(filters: CampaignFilters): Promise<CampaignResult> {
  const supabase = publicSupabase();
  const from = (filters.page - 1) * PAGE_SIZE;
  let query = supabase
    .from("campaigns")
    .select("id, organization_id, owner_type, slug, title, summary, target_amount, campaign_type, category, province, status, published_at, created_at", { count: "exact" })
    .in("status", [...PUBLIC_STATUSES])
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (filters.query) query = query.ilike("title", `%${filters.query}%`);
  if (CAMPAIGN_CATEGORIES.includes(filters.category as (typeof CAMPAIGN_CATEGORIES)[number])) query = query.eq("category", filters.category);
  if (PROVINCES.includes(filters.province as (typeof PROVINCES)[number])) query = query.eq("province", filters.province);
  if (filters.type === "direct" || filters.type === "partner") query = query.eq("campaign_type", filters.type);
  if (filters.owner === "organization" || filters.owner === "individual") query = query.eq("owner_type", filters.owner);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const organizationIds = Array.from(new Set(rows.map((campaign) => campaign.organization_id).filter(Boolean)));
  const { data: organizations, error: organizationError } = organizationIds.length
    ? await supabase.from("organizations").select("id, name").in("id", organizationIds)
    : { data: [], error: null };
  if (organizationError) throw new Error(organizationError.message);

  const names = new Map((organizations ?? []).map((organization) => [organization.id, organization.name]));
  return {
    campaigns: rows.map((campaign) => ({
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      summary: campaign.summary,
      targetAmount: Number(campaign.target_amount),
      organizationName: campaign.owner_type === "individual" ? undefined : names.get(campaign.organization_id) ?? "Tổ chức thiện nguyện",
      ownerType: campaign.owner_type,
      campaignType: campaign.campaign_type,
      category: campaign.category,
      province: campaign.province,
      status: campaign.status,
      publishedAt: campaign.published_at,
    })),
    total: count ?? 0,
  };
}

const cachedCampaignQuery = unstable_cache(
  (query: string, category: string, province: string, type: string, owner: string, page: number) =>
    queryCampaigns({ query, category, province, type, owner, page }),
  ["public-campaign-directory-v1"],
  { revalidate: 60, tags: ["public-campaigns"] },
);

const campaignStale = new Map<string, CampaignResult>();

export async function getPublicCampaigns(filters: CampaignFilters) {
  const normalized = {
    query: filters.query.replace(/[%,]/g, "").trim().slice(0, 80),
    category: filters.category,
    province: filters.province,
    type: filters.type,
    owner: filters.owner,
    page: Math.max(1, filters.page),
  };
  const key = JSON.stringify(normalized);

  if (!hasSupabaseEnv()) {
    return { ...(campaignStale.get(key) ?? { campaigns: [], total: 0 }), stale: true, error: "Dịch vụ dữ liệu hiện chưa được cấu hình." };
  }

  try {
    const result = await cachedCampaignQuery(normalized.query, normalized.category, normalized.province, normalized.type, normalized.owner, normalized.page);
    campaignStale.set(key, result);
    return { ...result, stale: false, error: null };
  } catch (error) {
    console.error("Public campaign query failed", error);
    return {
      ...(campaignStale.get(key) ?? { campaigns: [], total: 0 }),
      stale: true,
      error: "Không thể kết nối dữ liệu chiến dịch. Đang hiển thị bản lưu gần nhất nếu có.",
    };
  }
}

async function queryNews(): Promise<NewsResult> {
  const { data, error } = await publicSupabase()
    .from("news_posts")
    .select(NEWS_SELECT)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { posts: (data ?? []) as NewsPost[] };
}

const cachedNewsQuery = unstable_cache(queryNews, ["public-news-list-v1"], {
  revalidate: 60,
  tags: ["public-news"],
});
let newsStale: NewsPost[] | null = null;

export async function getPublicNews() {
  if (!hasSupabaseEnv()) {
    return { posts: newsStale ?? [], stale: true, error: "Dịch vụ dữ liệu hiện chưa được cấu hình." };
  }
  try {
    const { posts } = await cachedNewsQuery();
    newsStale = posts;
    return { posts, stale: false, error: null };
  } catch (error) {
    console.error("Public news query failed", error);
    return {
      posts: newsStale ?? [],
      stale: true,
      error: "Không thể kết nối dữ liệu tin tức. Đang hiển thị bản lưu gần nhất nếu có.",
    };
  }
}

async function queryNewsPost(slug: string): Promise<NewsPost | null> {
  const { data, error } = await publicSupabase()
    .from("news_posts")
    .select(NEWS_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as NewsPost | null;
}

const cachedNewsPostQuery = unstable_cache(queryNewsPost, ["public-news-post-v1"], {
  revalidate: 60,
  tags: ["public-news"],
});
const newsPostStale = new Map<string, NewsPost | null>();

export async function getPublicNewsPost(slug: string) {
  try {
    const post = await cachedNewsPostQuery(slug);
    newsPostStale.set(slug, post);
    return { post, stale: false, error: null };
  } catch (error) {
    console.error("Public news detail query failed", error);
    return {
      post: newsPostStale.get(slug) ?? null,
      stale: true,
      error: "Không thể tải bài viết từ máy chủ dữ liệu.",
    };
  }
}
