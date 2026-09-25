import Link from "next/link";
import { ReportsDashboard } from "@/components/reports/reports-dashboard";
import { SiteHeader } from "@/components/site-header";
import { loadPublicReports } from "@/lib/reports/public";

export const dynamic = "force-dynamic";

const tabs = new Set(["annual", "quarter", "half", "campaign"]);

export default async function ReportsPage({ searchParams }: { searchParams: { year?: string; tab?: string } }) {
  const currentYear = new Date().getFullYear();
  const requestedYear = Number(searchParams.year);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2021 && requestedYear <= currentYear ? requestedYear : currentYear;
  const initialTab = tabs.has(searchParams.tab ?? "") ? searchParams.tab as "annual" | "quarter" | "half" | "campaign" : "annual";
  const { periods, campaigns, loadError } = await loadPublicReports(year);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-[1160px] px-6 py-10 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Báo cáo minh bạch</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-chamDeep sm:text-4xl">Chiến dịch, quý và bán niên</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-inkMid">Số liệu được tổng hợp trực tiếp từ giao dịch đã đối soát và hồ sơ giải ngân đã hậu kiểm hợp lệ. Không hiển thị email, số tài khoản hay danh tính nhà hảo tâm.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className="text-xs font-bold text-inkSoft">Năm báo cáo</span>
            {[currentYear - 1, currentYear].filter((value) => value >= 2021).map((value) => <Link key={value} href={`/reports?year=${value}&tab=${initialTab}`} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${value === year ? "border-son bg-son text-white" : "border-lineStrong bg-white text-inkMid"}`}>{value}</Link>)}
          </div>
        </div>
        <div className="mt-8"><ReportsDashboard year={year} periods={periods} campaigns={campaigns} initialTab={initialTab} loadError={loadError} /></div>
      </section>
    </main>
  );
}
