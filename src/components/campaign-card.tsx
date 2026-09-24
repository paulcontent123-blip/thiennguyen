import Link from "next/link";
import { CampaignFollowButton } from "@/components/campaigns/campaign-follow-button";
import type { CampaignFollowState } from "@/lib/campaigns/follows";

const currency = new Intl.NumberFormat("vi-VN");

export type CampaignCardData = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  targetAmount: number;
  organizationName?: string;
  ownerType?: string;
  campaignType?: string;
  category?: string | null;
  province?: string | null;
  status?: string;
  coverUrl?: string | null;
  receivedAmount?: number;
};

const statusLabels: Record<string, string> = {
  approved: "Đã duyệt",
  active: "Đang hoạt động",
  closed: "Đã đóng",
};

export function CampaignCard({ campaign, follow }: {
  campaign: CampaignCardData;
  follow?: { state: CampaignFollowState; viewer: "guest" | "donor" | "other" };
}) {
  return (
    <div className="group relative">
    <Link
      href={`/campaigns/${encodeURIComponent(campaign.slug)}`}
      className="flex h-full flex-col gap-3 rounded-[14px] border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-card"
    >
      <div
        className="relative flex h-32 items-center justify-center overflow-hidden rounded-[8px] bg-gradient-to-br from-chamSoft to-paperDeep text-4xl transition group-hover:from-sonSoft group-hover:to-ngheXsoft"
        style={campaign.coverUrl ? { backgroundImage: `url("${campaign.coverUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        aria-label={campaign.coverUrl ? `Ảnh cover ${campaign.title}` : undefined}
      >
        {campaign.coverUrl ? <span className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" /> : <span>🏛️</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        {campaign.status ? <span className="rounded-full bg-luaSoft px-2 py-1 text-lua">{statusLabels[campaign.status] ?? campaign.status}</span> : null}
        {campaign.category ? <span className="rounded-full bg-paperDeep px-2 py-1 text-inkMid">{campaign.category}</span> : null}
        {campaign.province ? <span className="rounded-full bg-skySoft px-2 py-1 text-sky">📍 {campaign.province}</span> : null}
      </div>
      <h3 className="font-serif text-lg font-semibold leading-snug text-chamDeep group-hover:text-son">{campaign.title}</h3>
      <p className="line-clamp-3 text-[13px] leading-5 text-inkMid">{campaign.summary || "Chiến dịch thiện nguyện đang cần sự đồng hành của cộng đồng."}</p>
      {campaign.ownerType === "individual" ? <p className="text-xs font-bold text-inkSoft">Chủ chiến dịch: Nhà hảo tâm đã xác minh</p> : campaign.organizationName ? <p className="text-xs font-bold text-inkSoft">Đơn vị: {campaign.organizationName}</p> : null}
      {typeof campaign.receivedAmount === "number" ? <p className="text-xs text-inkSoft">Đã nhận: <span className="font-bold text-lua">{currency.format(campaign.receivedAmount)}₫</span></p> : null}
      <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-[13px]">
        <span className="font-bold text-son">{currency.format(campaign.targetAmount)}₫</span>
        <span className="font-bold text-sky">Xem chi tiết →</span>
      </div>
    </Link>
    {follow && campaign.id ? (
      <div className="absolute right-6 top-6 z-10">
        <CampaignFollowButton campaignId={campaign.id} campaignSlug={campaign.slug} initialState={follow.state} viewer={follow.viewer} compact />
      </div>
    ) : null}
    </div>
  );
}
