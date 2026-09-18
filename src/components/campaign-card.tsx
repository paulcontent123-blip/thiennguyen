import Link from "next/link";

const currency = new Intl.NumberFormat("vi-VN");

export type CampaignCardData = {
  slug: string;
  title: string;
  summary: string;
  targetAmount: number;
};

export function CampaignCard({ campaign }: { campaign: CampaignCardData }) {
  // Trang chi tiết /campaigns/[slug] chưa được dựng (nằm ngoài phạm vi đợt này) — tạm trỏ về danh sách chung.
  return (
    <Link
      href="/campaigns"
      className="flex flex-col gap-3 rounded-[14px] border border-line bg-white p-4 transition hover:shadow-card"
    >
      <div className="flex h-32 items-center justify-center rounded-[8px] bg-chamSoft text-3xl">
        &#127974;
      </div>
      <h3 className="font-serif text-base font-semibold leading-snug text-chamDeep">{campaign.title}</h3>
      <p className="line-clamp-2 text-[13px] leading-5 text-inkMid">{campaign.summary}</p>
      <div className="mt-auto flex items-center justify-between text-[13px]">
        <span className="font-bold text-son">{currency.format(campaign.targetAmount)}đ</span>
        <span className="text-inkSoft">Mục tiêu</span>
      </div>
    </Link>
  );
}
