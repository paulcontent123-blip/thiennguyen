export const CAMPAIGN_CATEGORIES = ["Giáo dục", "Y tế", "Nhà ở", "Lương thực", "Cứu trợ khẩn cấp", "Cộng đồng"] as const;

export type CampaignCategory = (typeof CAMPAIGN_CATEGORIES)[number];
