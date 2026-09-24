import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CampaignFollowState = { count: number; followed: boolean };

export async function getCampaignFollowStates(
  supabase: ReturnType<typeof createClient>,
  campaignIds: string[],
  donorUserId?: string,
): Promise<Record<string, CampaignFollowState>> {
  const ids = Array.from(new Set(campaignIds));
  if (ids.length === 0) return {};

  const [countsResult, followsResult] = await Promise.all([
    supabase.rpc("get_public_campaign_follow_counts", { p_campaign_ids: ids }),
    donorUserId
      ? supabase.from("campaign_follows").select("campaign_id").eq("user_id", donorUserId).in("campaign_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (countsResult.error) console.warn("Campaign follow counts unavailable", countsResult.error.code);
  if (followsResult.error) console.warn("Campaign follows unavailable", followsResult.error.code);

  const countRows = (countsResult.data ?? []) as { campaign_id: string; follower_count: number | string }[];
  const followRows = (followsResult.data ?? []) as { campaign_id: string }[];
  const counts = new Map<string, number>(countRows.map((row) => [row.campaign_id, Number(row.follower_count) || 0]));
  const followedIds = new Set(followRows.map((row) => row.campaign_id));

  return Object.fromEntries(ids.map((id) => [id, { count: counts.get(id) ?? 0, followed: followedIds.has(id) }]));
}
