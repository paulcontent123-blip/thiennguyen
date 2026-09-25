import type { MetadataRoute } from "next";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600;

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/campaigns`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/news`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/sos`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
    { url: `${siteUrl}/donate-items`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/transparency`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/reports`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/corporate`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/introduction`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  if (!hasSupabaseEnv()) return staticPages;

  const supabase = createClient();
  const [campaignsResult, newsResult] = await Promise.all([
    supabase
      .from("campaigns")
      .select("slug, published_at, updated_at, created_at")
      .in("status", ["approved", "active", "closed"])
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(5000),
    supabase
      .from("news_posts")
      .select("slug, published_at, updated_at")
      .eq("status", "published")
      .not("published_at", "is", null)
      .lte("published_at", now.toISOString())
      .order("published_at", { ascending: false })
      .limit(5000),
  ]);

  if (campaignsResult.error) console.warn("Sitemap campaigns query failed", campaignsResult.error.code);
  if (newsResult.error) console.warn("Sitemap news query failed", newsResult.error.code);

  const campaigns: MetadataRoute.Sitemap = (campaignsResult.data ?? []).map((campaign) => ({
    url: `${siteUrl}/campaigns/${campaign.slug}`,
    lastModified: new Date(campaign.updated_at || campaign.published_at || campaign.created_at),
    changeFrequency: "weekly",
    priority: 0.8,
  }));
  const news: MetadataRoute.Sitemap = (newsResult.data ?? []).map((post) => ({
    url: `${siteUrl}/news/${post.slug}`,
    lastModified: new Date(post.updated_at || post.published_at),
    changeFrequency: "monthly",
    priority: 0.65,
  }));

  return [...staticPages, ...campaigns, ...news];
}
