"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClosedCampaignReport, PeriodReport } from "@/lib/reports/types";

type TabKey = "annual" | "quarter" | "half" | "campaign";

const money = new Intl.NumberFormat("vi-VN");
const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatMoney(value: number) {
  return `${money.format(value)}đ`;
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function PeriodCard({ report, year }: { report: PeriodReport; year: number }) {
  const balance = report.total_received_vnd - report.total_disbursed_vnd;
  const exportReport = () => downloadCsv(`bao-cao-${report.period_key.toLowerCase()}.csv`, [
    ["Kỳ báo cáo", "Từ ngày", "Đến ngày", "Tổng thu VND", "Tổng giải ngân hợp lệ VND", "Số dư VND", "Lượt ủng hộ", "Chiến dịch phát sinh"],
    [report.period_key, report.period_start, report.period_end, report.total_received_vnd, report.total_disbursed_vnd, balance, report.completed_donation_count, report.campaign_count],
  ]);

  return (
    <article className={`rounded-[12px] border bg-white p-5 ${report.is_complete ? "border-line" : "border-dashed border-lineStrong"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-serif text-lg font-bold text-chamDeep">{report.period_key}</p>
          <p className="mt-1 text-xs text-inkSoft">{date.format(new Date(`${report.period_start}T00:00:00`))} – {date.format(new Date(`${report.period_end}T00:00:00`))}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${report.is_complete ? "bg-lua/15 text-lua" : "bg-nghe/15 text-ngheDeep"}`}>
          {report.is_complete ? "Đã kết thúc kỳ" : "Đang cập nhật"}
        </span>
      </div>
      <dl className="mt-5 space-y-2.5 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-inkSoft">Tổng tiền thực nhận</dt><dd className="font-mono font-bold text-son">{formatMoney(report.total_received_vnd)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-inkSoft">Giải ngân hậu kiểm hợp lệ</dt><dd className="font-mono font-bold text-lua">{formatMoney(report.total_disbursed_vnd)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-inkSoft">Lượt ủng hộ</dt><dd className="font-bold text-chamDeep">{money.format(report.completed_donation_count)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-inkSoft">Chiến dịch có phát sinh</dt><dd className="font-bold text-chamDeep">{money.format(report.campaign_count)}</dd></div>
      </dl>
      <button type="button" onClick={exportReport} className="mt-5 w-full rounded-[7px] border border-lineStrong px-3 py-2 text-xs font-bold text-chamDeep hover:border-son hover:text-son">
        Xuất CSV {report.period_key}
      </button>
      {!report.is_complete ? <p className="mt-2 text-[11px] leading-5 text-inkSoft">Số liệu {year} còn thay đổi vì kỳ báo cáo chưa kết thúc.</p> : null}
    </article>
  );
}

export function ReportsDashboard({ year, periods, campaigns, initialTab = "annual", loadError }: { year: number; periods: PeriodReport[]; campaigns: ClosedCampaignReport[]; initialTab?: TabKey; loadError?: string | null }) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const quarters = periods.filter((item) => item.period_type === "quarter");
  const halves = periods.filter((item) => item.period_type === "half");
  const [query, setQuery] = useState("");
  const yearCampaigns = useMemo(() => campaigns.filter((item) => item.closed_at && new Date(item.closed_at).getFullYear() === year), [campaigns, year]);
  const visibleCampaigns = useMemo(() => yearCampaigns.filter((item) => `${item.title} ${item.owner_name} ${item.province ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [yearCampaigns, query]);
  const annual = quarters.reduce((result, item) => ({
    received: result.received + item.total_received_vnd,
    disbursed: result.disbursed + item.total_disbursed_vnd,
    donations: result.donations + item.completed_donation_count,
  }), { received: 0, disbursed: 0, donations: 0 });
  const annualCampaigns = new Set(yearCampaigns.map((item) => item.campaign_id)).size;

  const exportAnnual = () => downloadCsv(`bao-cao-nam-${year}.csv`, [
    ["Năm", "Tổng thu VND", "Tổng giải ngân hợp lệ VND", "Số dư VND", "Lượt ủng hộ", "Chiến dịch đã đóng"],
    [year, annual.received, annual.disbursed, annual.received - annual.disbursed, annual.donations, annualCampaigns],
  ]);

  const tabs: Array<[TabKey, string]> = [["annual", "Báo cáo năm"], ["quarter", "Theo quý"], ["half", "Bán niên"], ["campaign", "Theo chiến dịch"]];

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-1 border-b border-line print:hidden">
        {tabs.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`-mb-px border-b-2 px-4 py-3 text-sm font-bold ${tab === key ? "border-son text-son" : "border-transparent text-inkSoft hover:text-chamDeep"}`}>{label}</button>)}
      </div>

      {loadError ? <div className="mb-6 rounded-[10px] border border-nghe/30 bg-nghe/10 p-4 text-sm text-ngheDeep">{loadError}</div> : null}

      {tab === "annual" ? <section>
        <div className="rounded-[16px] bg-chamDeep p-6 text-white sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">Năm tài chính {year}</p><h2 className="mt-2 font-serif text-3xl font-semibold">Báo cáo tổng hợp đang cập nhật</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Chỉ tính giao dịch đã đối soát thành công và khoản giải ngân đã được Admin hậu kiểm hợp lệ.</p></div>
            <div className="flex gap-2 print:hidden"><button type="button" onClick={exportAnnual} className="rounded-[7px] border border-white/25 px-4 py-2 text-sm font-bold">Xuất CSV</button><button type="button" onClick={() => window.print()} className="rounded-[7px] bg-son px-4 py-2 text-sm font-bold">In / lưu PDF</button></div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[[formatMoney(annual.received), "Tổng tiền thực nhận"], [formatMoney(annual.disbursed), "Giải ngân hợp lệ"], [money.format(annual.donations), "Lượt ủng hộ"], [money.format(annualCampaigns), "Chiến dịch đã đóng"]].map(([value, label]) => <div key={label} className="rounded-[10px] border border-line bg-white p-5"><p className="font-serif text-2xl font-bold text-chamDeep">{value}</p><p className="mt-1 text-xs text-inkSoft">{label}</p></div>)}
        </div>
        <div className="mt-5 rounded-[10px] border border-line bg-white p-5 text-sm leading-6 text-inkMid"><strong className="text-chamDeep">Phạm vi số liệu:</strong> báo cáo này là tổng hợp động từ database, chưa phải báo cáo tài chính đã niêm phong hoặc kiểm toán. Khi dữ liệu giao dịch hay hậu kiểm thay đổi, số liệu sẽ cập nhật theo.</div>
      </section> : null}

      {tab === "quarter" ? <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{quarters.map((report) => <PeriodCard key={report.period_key} report={report} year={year} />)}</section> : null}
      {tab === "half" ? <section className="grid gap-4 md:grid-cols-2">{halves.map((report) => <PeriodCard key={report.period_key} report={report} year={year} />)}</section> : null}

      {tab === "campaign" ? <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-xl font-semibold text-chamDeep">Báo cáo chiến dịch đã đóng</h2><p className="mt-1 text-sm text-inkSoft">{yearCampaigns.length} chiến dịch công khai đóng trong năm {year}.</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm chiến dịch hoặc tổ chức…" className="w-full rounded-[8px] border border-line px-4 py-2.5 text-sm outline-none focus:border-son sm:w-72" /></div>
        <div className="space-y-3">
          {visibleCampaigns.length === 0 ? <div className="rounded-[12px] border-2 border-dashed border-lineStrong p-10 text-center text-sm text-inkSoft">Chưa có chiến dịch đã đóng phù hợp.</div> : visibleCampaigns.map((campaign) => <article key={campaign.campaign_id} className="rounded-[12px] border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-serif text-lg font-bold text-chamDeep">{campaign.title}</p><p className="mt-1 text-xs text-inkSoft">{campaign.owner_name}{campaign.province ? ` · ${campaign.province}` : ""}{campaign.closed_at ? ` · đóng ${date.format(new Date(campaign.closed_at))}` : ""}</p></div><span className="rounded-full bg-lua/15 px-3 py-1 text-xs font-bold text-lua">Đã đóng</span></div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><div><span className="block text-xs text-inkSoft">Thực nhận</span><strong className="font-mono text-son">{formatMoney(campaign.total_received_vnd)}</strong></div><div><span className="block text-xs text-inkSoft">Giải ngân hợp lệ</span><strong className="font-mono text-lua">{formatMoney(campaign.total_disbursed_vnd)}</strong></div><div><span className="block text-xs text-inkSoft">Lượt ủng hộ</span><strong>{money.format(campaign.completed_donation_count)}</strong></div><div><span className="block text-xs text-inkSoft">Tệp bằng chứng</span><strong>{money.format(campaign.evidence_file_count)}</strong></div></div>
            <div className="mt-4 flex flex-wrap gap-2 print:hidden"><Link href={`/campaigns/${campaign.slug}`} className="rounded-[7px] border border-lineStrong px-3 py-2 text-xs font-bold text-chamDeep hover:border-son hover:text-son">Trang công khai</Link><Link href={`/campaign-closure/${campaign.campaign_id}`} className="rounded-[7px] bg-chamDeep px-3 py-2 text-xs font-bold text-white">Xem dashboard tất toán →</Link></div>
          </article>)}
        </div>
      </section> : null}
    </div>
  );
}
