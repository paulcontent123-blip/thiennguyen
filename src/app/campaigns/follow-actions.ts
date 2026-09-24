"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { getCampaignFollowStates } from "@/lib/campaigns/follows";

type FollowResult =
  | { ok: true; followed: boolean; count: number }
  | { ok: false; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function toggleCampaignFollow(campaignId: string): Promise<FollowResult> {
  const { supabase, user } = await requireActionRole(["donor"]);
  if (!UUID_PATTERN.test(campaignId)) return { ok: false, message: "Chiến dịch không hợp lệ." };

  const { data: isPublic, error: visibilityError } = await supabase.rpc("is_public_campaign", { p_campaign_id: campaignId });
  if (visibilityError || !isPublic) return { ok: false, message: "Chiến dịch không còn công khai." };

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("slug, organization_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignError || !campaign) return { ok: false, message: "Không tìm thấy chiến dịch." };

  const { data: existing, error: lookupError } = await supabase
    .from("campaign_follows")
    .select("campaign_id")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) return { ok: false, message: "Không thể kiểm tra trạng thái theo dõi." };

  const { error: mutationError } = existing
    ? await supabase.from("campaign_follows").delete().eq("campaign_id", campaignId).eq("user_id", user.id)
    : await supabase.from("campaign_follows").insert({ campaign_id: campaignId, user_id: user.id });
  if (mutationError) return { ok: false, message: "Không thể cập nhật theo dõi. Vui lòng thử lại." };

  const states = await getCampaignFollowStates(supabase, [campaignId], user.id);
  revalidatePath("/");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaign.slug}`);
  revalidatePath("/account");
  if (campaign.organization_id) revalidatePath(`/organizations/${campaign.organization_id}`);

  return { ok: true, followed: states[campaignId]?.followed ?? !existing, count: states[campaignId]?.count ?? 0 };
}
