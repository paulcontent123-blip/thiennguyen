import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ReportsDashboard } from "@/components/reports/reports-dashboard";
import { loadPublicReports } from "@/lib/reports/public";
import { getHomepageStats } from "@/lib/stats/homepage-stats";

const number = new Intl.NumberFormat("vi-VN");

export default async function TransparencyPage() {
  const year = new Date().getFullYear();
  const [stats, reports] = await Promise.all([getHomepageStats(), loadPublicReports(year)]);

  const summary = [
    [`${(stats.totalReceivedVnd / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu`, "Tổng tiền đã ghi nhận"],
    [number.format(stats.publicCampaignCount), "Chiến dịch công khai"],
    [number.format(stats.completedDonationCount), "Lượt ủng hộ đã xác nhận"],
    ["90 / 10", "Tách thực thi / vận hành (chiến dịch Trực tiếp)"],
  ] as const;

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-[1160px] px-7 py-10">
        <p className="eyebrow">Minh bạch</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-chamDeep sm:text-4xl">Sao kê tổng &amp; Báo cáo tài chính</h1>
        <p className="mt-3 max-w-2xl leading-7 text-inkMid">
          Số liệu tổng hợp công khai theo chiến dịch và kỳ báo cáo, lấy trực tiếp từ giao dịch đã đối soát và hồ sơ giải ngân đã hậu kiểm.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summary.map(([value, label]) => (
            <div key={label} className="rounded-[8px] border border-line bg-white p-4 text-center">
              <div className="font-serif text-2xl font-bold text-chamDeep">{value}</div>
              <div className="mt-1 text-xs text-inkSoft">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-inkSoft">Chỉ tính các giao dịch đã được Admin đối soát khớp sao kê, thuộc chiến dịch công khai.</p>

        <div className="mt-8 flex justify-end print:hidden"><Link href="/reports" className="text-sm font-bold text-sky hover:underline">Mở trang báo cáo riêng →</Link></div>
        <div className="mt-4"><ReportsDashboard year={year} periods={reports.periods} campaigns={reports.campaigns} loadError={reports.loadError} /></div>
      </section>
    </main>
  );
}
