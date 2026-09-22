export type CampaignMediaType = "cover" | "video" | "photo" | "poster";
export type CampaignMediaSlot = "start" | "mid" | "handover";
export type CampaignUpdateType = "general" | CampaignMediaSlot;

export type CampaignMedia = {
  id: string;
  campaign_id: string;
  update_id: string | null;
  media_type: CampaignMediaType;
  slot: CampaignMediaSlot | null;
  provider: string;
  title: string;
  alt_text: string;
  url: string;
  public_id: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type CampaignUpdate = {
  id: string;
  campaign_id: string;
  update_type: CampaignUpdateType;
  title: string;
  body: string;
  location_text: string | null;
  event_at: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type CampaignPaymentConfig = {
  campaign_id: string;
  provider: "vietqr";
  bank_id: string;
  account_no: string;
  account_name: string;
  description_template: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CampaignSeo = {
  campaign_id: string;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  schema_type: string;
  schema_json: Record<string, unknown>;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type CampaignShareSettings = {
  campaign_id: string;
  zalo_enabled: boolean;
  facebook_enabled: boolean;
  copy_enabled: boolean;
  share_title: string | null;
  share_description: string | null;
  share_image_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type VietQrInput = Pick<CampaignPaymentConfig, "bank_id" | "account_no" | "account_name" | "description_template">;

function replaceTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(campaign_slug|campaign_id|tx_ref)\}/g, (_, key: string) => values[key] ?? "");
}

export function buildVietQrUrl(
  config: VietQrInput,
  input: { amount?: number; campaignSlug: string; campaignId: string; txRef?: string },
) {
  const amount = input.amount && input.amount > 0 ? Math.round(input.amount) : null;
  const description = replaceTemplate(config.description_template, {
    campaign_slug: input.campaignSlug,
    campaign_id: input.campaignId,
    tx_ref: input.txRef ?? "",
  });
  const path = `${encodeURIComponent(config.bank_id)}-${encodeURIComponent(config.account_no)}-compact2.png`;
  const params = new URLSearchParams({
    addInfo: description,
    accountName: config.account_name,
  });
  if (amount) params.set("amount", String(amount));
  return `https://img.vietqr.io/image/${path}?${params.toString()}`;
}

export function defaultCampaignSchema(input: {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  organizationName?: string | null;
  createdAt?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "LiveBlogPosting",
    headline: input.title,
    description: input.description,
    url: input.url,
    image: input.image ? [input.image] : undefined,
    author: input.organizationName
      ? { "@type": "Organization", name: input.organizationName }
      : undefined,
    datePublished: input.createdAt,
  };
}

