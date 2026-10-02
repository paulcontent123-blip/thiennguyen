import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { normalizeClosedCampaignReports, normalizePeriodReports } from "./types";

async function queryPublicReports(year: number) {
  const supabase = createPublicClient();
  const [periodResult, campaignResult] = await Promise.all([
    supabase.rpc("get_public_period_reports", { p_year: year }),
    supabase.rpc("get_public_closed_campaign_reports", { p_limit: 200 }),
  ]);

  const errors = [periodResult.error, campaignResult.error].filter(Boolean);
  return {
    periods: normalizePeriodReports(periodResult.data as unknown[] | null),
    campaigns: normalizeClosedCampaignReports(campaignResult.data as unknown[] | null),
    loadError: errors.length > 0
      ? "Chưa đọc được dữ liệu báo cáo. Hãy áp dụng migration 202609250001_reports_and_campaign_closure.sql lên database."
      : null,
  };
}

const cachedPublicReports = unstable_cache(queryPublicReports, ["public-reports-v1"], {
  revalidate: 60,
  tags: ["public-reports"],
});

export async function loadPublicReports(year: number) {
  return cachedPublicReports(year);
}
