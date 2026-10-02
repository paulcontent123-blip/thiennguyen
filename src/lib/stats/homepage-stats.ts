import { unstable_cache } from "next/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

export type HomepageStats = {
  verifiedOrganizationCount: number;
  verifiedPersonalProfileCount: number;
  publicCampaignCount: number;
  memberCount: number;
  completedDonationCount: number;
  totalReceivedVnd: number;
  donorCount: number;
};

const emptyStats: HomepageStats = {
    verifiedOrganizationCount: 0,
    verifiedPersonalProfileCount: 0,
    publicCampaignCount: 0,
    memberCount: 0,
    completedDonationCount: 0,
    totalReceivedVnd: 0,
    donorCount: 0,
};

async function queryHomepageStats(): Promise<HomepageStats> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_homepage_stats");
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    verifiedOrganizationCount: Number(row?.verified_organization_count ?? 0),
    verifiedPersonalProfileCount: Number(row?.verified_personal_profile_count ?? 0),
    publicCampaignCount: Number(row?.public_campaign_count ?? 0),
    memberCount: Number(row?.member_count ?? 0),
    completedDonationCount: Number(row?.completed_donation_count ?? 0),
    totalReceivedVnd: Number(row?.total_received_vnd ?? 0),
    donorCount: Number(row?.donor_count ?? 0),
  };
}

const cachedHomepageStats = unstable_cache(queryHomepageStats, ["homepage-stats-v1"], {
  revalidate: 60,
  tags: ["public-stats"],
});

export async function getHomepageStats(): Promise<HomepageStats> {
  if (!hasSupabaseEnv()) return emptyStats;
  try {
    return await cachedHomepageStats();
  } catch (error) {
    console.warn("Homepage statistics are unavailable", error);
    return emptyStats;
  }
}
