import "server-only";

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

async function queryPublicResourceDirectory() {
  const supabase = createPublicClient();
  let [needsResult, offersResult] = await Promise.all([
    supabase.rpc("get_public_resource_needs_page", { p_limit: 100, p_offset: 0 }),
    supabase.rpc("get_public_resource_offers_page", { p_limit: 100, p_offset: 0 }),
  ]);
  if (needsResult.error) needsResult = await supabase.rpc("get_public_resource_needs");
  if (offersResult.error) offersResult = await supabase.rpc("get_public_resource_offers");
  return {
    needs: (needsResult.data ?? []) as unknown[],
    offers: (offersResult.data ?? []) as unknown[],
    hasError: Boolean(needsResult.error || offersResult.error),
  };
}

const cachedPublicResourceDirectory = unstable_cache(
  queryPublicResourceDirectory,
  ["public-resource-directory-v1"],
  { revalidate: 30, tags: ["public-resources"] },
);

async function queryCampaignResourceNeeds(campaignId: string) {
  const supabase = createPublicClient();
  const result = await supabase.rpc("get_public_resource_needs_page", {
    p_limit: 100,
    p_offset: 0,
    p_campaign_id: campaignId,
  });
  if (!result.error) return (result.data ?? []) as unknown[];
  const fallback = await supabase.rpc("get_public_resource_needs");
  return ((fallback.data ?? []) as Array<{ campaign_id?: string }>).filter((item) => item.campaign_id === campaignId);
}

const cachedCampaignResourceNeeds = unstable_cache(
  queryCampaignResourceNeeds,
  ["public-campaign-resource-needs-v1"],
  { revalidate: 30, tags: ["public-resources"] },
);

export function getPublicResourceDirectory() {
  return cachedPublicResourceDirectory();
}

export function getPublicCampaignResourceNeeds(campaignId: string) {
  return cachedCampaignResourceNeeds(campaignId);
}
