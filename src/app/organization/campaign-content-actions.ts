"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { buildCloudinaryDerivedImageUrl, destroyCloudinaryAsset, uploadToCloudinary } from "@/lib/cloudinary/server";
import { defaultCampaignSchema, type CampaignMediaSlot, type CampaignMediaType, type CampaignUpdateType } from "@/lib/campaigns/content";

export type CampaignContentActionResult = { ok: true; message: string } | { ok: false; message: string };

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MEDIA_TYPES: CampaignMediaType[] = ["cover", "video", "photo", "poster"];
const VIDEO_SLOTS: CampaignMediaSlot[] = ["start", "mid", "handover"];
const UPDATE_TYPES: CampaignUpdateType[] = ["general", "start", "mid", "handover"];

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function booleanValue(formData: FormData, key: string, fallback = false) {
  const value = formData.get(key);
  if (value === null) return fallback;
  return value === "true" || value === "on" || value === "1";
}

function getFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function requireHttpsUrl(value: string, label: string, required = false) {
  if (!value) {
    if (required) throw new Error(`${label} là bắt buộc.`);
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new Error(`${label} phải là URL HTTPS hợp lệ.`);
  }
}

function detectProvider(value: string) {
  const hostname = new URL(value).hostname.toLowerCase();
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
  if (hostname.includes("facebook.com") || hostname.includes("fb.watch")) return "facebook";
  if (hostname.includes("tiktok.com")) return "tiktok";
  return "external";
}

async function requireCampaignManager(campaignId: string) {
  const { supabase, user, role } = await requireActionRole(["donor", "org", "admin"]);
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id, organization_id, owner_type, owner_user_id, slug, title, description, status, created_at")
    .eq("id", campaignId)
    .maybeSingle();

  if (error || !campaign) throw new Error("Không tìm thấy chiến dịch.");

  if (role === "org") {
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", campaign.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (organizationError || !organization) throw new Error("Bạn không có quyền quản lý chiến dịch này.");
  }

  if (role === "donor" && (campaign.owner_type !== "individual" || campaign.owner_user_id !== user.id)) {
    throw new Error("Bạn không có quyền quản lý chiến dịch này.");
  }

  if (role !== "admin" && ["pending_review", "rejected"].includes(campaign.status)) {
    throw new Error(campaign.status === "pending_review"
      ? "Chiến dịch đang được Admin xét duyệt nên nội dung tạm thời bị khóa."
      : "Chiến dịch đã bị từ chối nên không thể cập nhật nội dung công khai.");
  }

  return { supabase, user, role, campaign };
}

function refreshCampaignContent(campaign: { id: string; slug: string }) {
  revalidatePath(`/campaigns/${campaign.slug}`);
  revalidatePath(`/organization/campaigns/${campaign.id}`);
  revalidatePath("/organization");
  revalidatePath(`/campaign-management/${campaign.id}`);
  revalidatePath("/personal-campaigns");
  revalidatePath("/admin");
}

export async function upsertCampaignMedia(formData: FormData): Promise<CampaignContentActionResult> {
  const campaignId = text(formData, "campaignId");
  const mediaId = nullableText(formData, "mediaId");
  const mediaType = text(formData, "mediaType") as CampaignMediaType;
  const slotValue = text(formData, "slot");
  const slot = slotValue ? (slotValue as CampaignMediaSlot) : null;
  const title = text(formData, "title");
  const altText = text(formData, "altText");
  const thumbnailUrlInput = text(formData, "thumbnailUrl");
  const urlInput = text(formData, "url");
  const isPublic = booleanValue(formData, "isPublic");
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const file = getFile(formData, "file");

  if (!MEDIA_TYPES.includes(mediaType)) return { ok: false, message: "Loại media không hợp lệ." };
  if (mediaType === "video" && !VIDEO_SLOTS.includes(slot as CampaignMediaSlot)) {
    return { ok: false, message: "Video phải có vị trí bắt đầu, giữa kỳ hoặc bàn giao." };
  }
  if (mediaType !== "video" && slot) return { ok: false, message: "Ảnh không cần vị trí video." };
  if (title.length > 180 || altText.length > 300) return { ok: false, message: "Tiêu đề hoặc mô tả media quá dài." };
  if (!Number.isInteger(sortOrder) || sortOrder < 0) return { ok: false, message: "Thứ tự media không hợp lệ." };

  const { supabase, user, campaign } = await requireCampaignManager(campaignId);
  let existing: { id: string; url: string; public_id: string | null; provider: string } | null = null;

  if (mediaId) {
    const { data, error } = await supabase
      .from("campaign_media")
      .select("id, url, public_id, provider")
      .eq("id", mediaId)
      .eq("campaign_id", campaign.id)
      .maybeSingle();
    if (error || !data) return { ok: false, message: "Không tìm thấy media cần cập nhật." };
    existing = data;
  } else if (mediaType === "cover" || mediaType === "poster" || (mediaType === "video" && slot)) {
    const query = supabase
      .from("campaign_media")
      .select("id, url, public_id, provider")
      .eq("campaign_id", campaign.id)
      .eq("media_type", mediaType)
      .limit(1);
    const { data, error } = mediaType === "video" && slot
      ? await query.eq("slot", slot).maybeSingle()
      : await query.maybeSingle();
    if (error) return { ok: false, message: error.message };
    existing = data;
  }

  let uploaded: Awaited<ReturnType<typeof uploadToCloudinary>> | null = null;
  if (file) {
    if (mediaType === "video") return { ok: false, message: "Video cần dùng URL YouTube, Facebook, TikTok hoặc URL HTTPS." };
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE) {
      return { ok: false, message: "Ảnh phải là JPG, PNG hoặc WebP và không vượt quá 10 MB." };
    }
    try {
      uploaded = await uploadToCloudinary(file, `thiennguyen/campaigns/${campaign.id}/${mediaType}`, `${campaign.id}-${mediaType}-${Date.now()}`);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Upload media thất bại." };
    }
  }

  const isReplacingExternalUrl = Boolean(urlInput && existing && urlInput !== existing.url);
  let url = uploaded?.secureUrl ?? (urlInput || existing?.url || "");
  let provider = uploaded ? "cloudinary" : existing?.provider ?? "external";
  if (mediaType === "video") {
    try {
      url = requireHttpsUrl(url, "URL video", true) ?? "";
      provider = detectProvider(url);
    } catch (error) {
      if (uploaded) await destroyCloudinaryAsset(uploaded.publicId).catch(() => undefined);
      return { ok: false, message: error instanceof Error ? error.message : "URL video không hợp lệ." };
    }
  } else if (!url) {
    if (uploaded) await destroyCloudinaryAsset(uploaded.publicId).catch(() => undefined);
    return { ok: false, message: "Vui lòng upload file hoặc nhập URL media." };
  } else if (!uploaded) {
    try {
      url = requireHttpsUrl(url, "URL media", true) ?? "";
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "URL media không hợp lệ." };
    }
  }

  let thumbnailUrl: string | null = null;
  try {
    thumbnailUrl = requireHttpsUrl(thumbnailUrlInput, "Thumbnail", false);
  } catch (error) {
    if (uploaded) await destroyCloudinaryAsset(uploaded.publicId).catch(() => undefined);
    return { ok: false, message: error instanceof Error ? error.message : "Thumbnail không hợp lệ." };
  }

  const payload = {
    campaign_id: campaign.id,
    update_id: nullableText(formData, "updateId"),
    media_type: mediaType,
    slot: mediaType === "video" ? slot : null,
    provider,
    title,
    alt_text: altText,
    url,
    public_id: uploaded?.publicId ?? (isReplacingExternalUrl ? null : existing?.public_id ?? null),
    thumbnail_url: thumbnailUrl,
    sort_order: sortOrder,
    is_public: isPublic,
  };

  const result = existing
    ? await supabase.from("campaign_media").update(payload).eq("id", existing.id).eq("campaign_id", campaign.id)
    : await supabase.from("campaign_media").insert({ ...payload, created_by: user.id });

  if (result.error) {
    if (uploaded) await destroyCloudinaryAsset(uploaded.publicId).catch(() => undefined);
    return { ok: false, message: result.error.message };
  }

  if (existing?.public_id && existing.public_id !== payload.public_id) {
    await destroyCloudinaryAsset(existing.public_id).catch(() => undefined);
  }
  refreshCampaignContent(campaign);
  return { ok: true, message: existing ? "Đã cập nhật media chiến dịch." : "Đã thêm media chiến dịch." };
}

export async function deleteCampaignMedia(id: string): Promise<CampaignContentActionResult> {
  const { supabase, campaign } = await findCampaignFromContentRow("campaign_media", id);
  const { data: media } = await supabase.from("campaign_media").select("public_id").eq("id", id).eq("campaign_id", campaign.id).maybeSingle();
  const { error } = await supabase.from("campaign_media").delete().eq("id", id).eq("campaign_id", campaign.id);
  if (error) return { ok: false, message: error.message };
  await destroyCloudinaryAsset(media?.public_id).catch(() => undefined);
  refreshCampaignContent(campaign);
  return { ok: true, message: "Đã xóa media chiến dịch." };
}

export async function generateCampaignPoster(campaignId: string): Promise<CampaignContentActionResult> {
  const { supabase, campaign, user } = await requireCampaignManager(campaignId);
  const { data: cover, error: coverError } = await supabase
    .from("campaign_media")
    .select("url, public_id, provider, alt_text")
    .eq("campaign_id", campaign.id)
    .eq("media_type", "cover")
    .maybeSingle();

  if (coverError) return { ok: false, message: coverError.message };
  if (!cover?.public_id || cover.provider !== "cloudinary") {
    return { ok: false, message: "Cần có ảnh cover Cloudinary trước khi sinh poster." };
  }

  let posterUrl: string;
  try {
    posterUrl = buildCloudinaryDerivedImageUrl(cover.public_id);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không thể sinh poster." };
  }

  const { data: existingPoster, error: posterLookupError } = await supabase
    .from("campaign_media")
    .select("id")
    .eq("campaign_id", campaign.id)
    .eq("media_type", "poster")
    .maybeSingle();
  if (posterLookupError) return { ok: false, message: posterLookupError.message };

  const payload = {
    campaign_id: campaign.id,
    media_type: "poster",
    slot: null,
    provider: "cloudinary",
    title: `Poster 9:16 - ${campaign.title}`,
    alt_text: cover.alt_text || campaign.title,
    url: posterUrl,
    public_id: null,
    thumbnail_url: null,
    sort_order: 0,
    is_public: true,
  };
  const result = existingPoster
    ? await supabase.from("campaign_media").update(payload).eq("id", existingPoster.id).eq("campaign_id", campaign.id)
    : await supabase.from("campaign_media").insert({ ...payload, created_by: user.id });
  if (result.error) return { ok: false, message: result.error.message };

  refreshCampaignContent(campaign);
  return { ok: true, message: "Đã sinh poster 9:16 từ ảnh cover Cloudinary." };
}

async function findCampaignFromContentRow(table: "campaign_media" | "campaign_updates", id: string) {
  const { supabase } = await requireActionRole(["donor", "org", "admin"]);
  const { data: row, error } = await supabase.from(table).select("campaign_id").eq("id", id).maybeSingle();
  if (error || !row) throw new Error("Không tìm thấy nội dung chiến dịch.");
  const managed = await requireCampaignManager(row.campaign_id);
  return { ...managed, campaign: managed.campaign };
}

export async function upsertCampaignUpdate(formData: FormData): Promise<CampaignContentActionResult> {
  const campaignId = text(formData, "campaignId");
  const updateId = nullableText(formData, "updateId");
  const updateType = text(formData, "updateType") as CampaignUpdateType;
  const title = text(formData, "title");
  const body = text(formData, "body");
  const locationText = nullableText(formData, "locationText");
  const eventAtInput = text(formData, "eventAt");
  const isPublic = booleanValue(formData, "isPublic");

  if (!UPDATE_TYPES.includes(updateType)) return { ok: false, message: "Loại cập nhật không hợp lệ." };
  if (title.length < 2 || title.length > 180 || body.length < 2 || body.length > 10000) {
    return { ok: false, message: "Tiêu đề hoặc nội dung cập nhật chưa hợp lệ." };
  }
  const eventAt = eventAtInput ? new Date(eventAtInput) : new Date();
  if (Number.isNaN(eventAt.getTime())) return { ok: false, message: "Thời điểm cập nhật không hợp lệ." };

  const { supabase, user, campaign } = await requireCampaignManager(campaignId);
  const payload = {
    campaign_id: campaign.id,
    update_type: updateType,
    title,
    body,
    location_text: locationText,
    event_at: eventAt.toISOString(),
    is_public: isPublic,
  };
  const result = updateId
    ? await supabase.from("campaign_updates").update(payload).eq("id", updateId).eq("campaign_id", campaign.id)
    : await supabase.from("campaign_updates").insert({ ...payload, created_by: user.id });
  if (result.error) return { ok: false, message: result.error.message };
  refreshCampaignContent(campaign);
  return { ok: true, message: updateId ? "Đã cập nhật nhật ký thực địa." : "Đã thêm nhật ký thực địa." };
}

export async function deleteCampaignUpdate(id: string): Promise<CampaignContentActionResult> {
  const { supabase, campaign } = await findCampaignFromContentRow("campaign_updates", id);
  const { error } = await supabase.from("campaign_updates").delete().eq("id", id).eq("campaign_id", campaign.id);
  if (error) return { ok: false, message: error.message };
  refreshCampaignContent(campaign);
  return { ok: true, message: "Đã xóa nhật ký thực địa." };
}

export async function upsertCampaignSeo(formData: FormData): Promise<CampaignContentActionResult> {
  const campaignId = text(formData, "campaignId");
  const metaTitle = nullableText(formData, "metaTitle");
  const metaDescription = nullableText(formData, "metaDescription");
  const canonicalUrlInput = text(formData, "canonicalUrl");
  const schemaType = text(formData, "schemaType") || "LiveBlogPosting";
  const schemaInput = text(formData, "schemaJson");
  const isPublic = booleanValue(formData, "isPublic", true);

  if (metaTitle && metaTitle.length > 180) return { ok: false, message: "Meta title quá dài." };
  if (metaDescription && metaDescription.length > 320) return { ok: false, message: "Meta description quá dài." };
  if (schemaType.length > 80) return { ok: false, message: "Schema type quá dài." };

  let canonicalUrl: string | null;
  try {
    canonicalUrl = requireHttpsUrl(canonicalUrlInput, "Canonical URL", false);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Canonical URL không hợp lệ." };
  }

  const { supabase, user, campaign } = await requireCampaignManager(campaignId);
  let schemaJson: Record<string, unknown>;
  if (schemaInput) {
    try {
      const parsed = JSON.parse(schemaInput) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      schemaJson = parsed as Record<string, unknown>;
    } catch {
      return { ok: false, message: "Schema.org phải là JSON object hợp lệ." };
    }
  } else {
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    schemaJson = defaultCampaignSchema({
      title: campaign.title,
      description: campaign.description,
      url: canonicalUrl || `${baseUrl}/campaigns/${campaign.slug}`,
      organizationName: null,
      createdAt: campaign.created_at,
    });
  }
  if (JSON.stringify(schemaJson).length > 30000) return { ok: false, message: "Schema.org vượt quá giới hạn 30 KB." };

  const { error } = await supabase.from("campaign_seo").upsert({
    campaign_id: campaign.id,
    meta_title: metaTitle,
    meta_description: metaDescription,
    canonical_url: canonicalUrl,
    schema_type: schemaType,
    schema_json: schemaJson,
    is_public: isPublic,
    updated_by: user.id,
  }, { onConflict: "campaign_id" });
  if (error) return { ok: false, message: error.message };
  refreshCampaignContent(campaign);
  return { ok: true, message: "Đã lưu SEO và Schema.org." };
}

export async function deleteCampaignSeo(campaignId: string): Promise<CampaignContentActionResult> {
  const { supabase, campaign } = await requireCampaignManager(campaignId);
  const { error } = await supabase.from("campaign_seo").delete().eq("campaign_id", campaign.id);
  if (error) return { ok: false, message: error.message };
  refreshCampaignContent(campaign);
  return { ok: true, message: "Đã xóa cấu hình SEO." };
}

export async function upsertCampaignShareSettings(formData: FormData): Promise<CampaignContentActionResult> {
  const campaignId = text(formData, "campaignId");
  const shareTitle = nullableText(formData, "shareTitle");
  const shareDescription = nullableText(formData, "shareDescription");
  const shareImageInput = text(formData, "shareImageUrl");
  const isPublic = booleanValue(formData, "isPublic", true);
  let shareImageUrl: string | null;
  try {
    shareImageUrl = requireHttpsUrl(shareImageInput, "Ảnh chia sẻ", false);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Ảnh chia sẻ không hợp lệ." };
  }
  if (shareTitle && shareTitle.length > 180) return { ok: false, message: "Tiêu đề chia sẻ quá dài." };
  if (shareDescription && shareDescription.length > 320) return { ok: false, message: "Mô tả chia sẻ quá dài." };

  const { supabase, user, campaign } = await requireCampaignManager(campaignId);
  const { error } = await supabase.from("campaign_share_settings").upsert({
    campaign_id: campaign.id,
    zalo_enabled: booleanValue(formData, "zaloEnabled", true),
    facebook_enabled: booleanValue(formData, "facebookEnabled", true),
    copy_enabled: booleanValue(formData, "copyEnabled", true),
    share_title: shareTitle,
    share_description: shareDescription,
    share_image_url: shareImageUrl,
    is_public: isPublic,
    updated_by: user.id,
  }, { onConflict: "campaign_id" });
  if (error) return { ok: false, message: error.message };
  refreshCampaignContent(campaign);
  return { ok: true, message: "Đã lưu cấu hình chia sẻ." };
}

export async function deleteCampaignShareSettings(campaignId: string): Promise<CampaignContentActionResult> {
  const { supabase, campaign } = await requireCampaignManager(campaignId);
  const { error } = await supabase.from("campaign_share_settings").delete().eq("campaign_id", campaign.id);
  if (error) return { ok: false, message: error.message };
  refreshCampaignContent(campaign);
  return { ok: true, message: "Đã xóa cấu hình chia sẻ." };
}
