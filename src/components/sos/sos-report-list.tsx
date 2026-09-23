"use client";

import { useMemo, useState } from "react";

type SosReport = {
  id: string;
  location_text: string;
  description: string | null;
  needs: string[];
  status: string;
  photo_url: string | null;
  created_at: string;
};

const datetime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const statusLabels: Record<string, { label: string; className: string }> = {
  urgent: { label: "Khẩn cấp", className: "bg-son/15 text-son" },
  needs_support: { label: "Cần hỗ trợ", className: "bg-nghe/15 text-ngheDeep" },
  handled: { label: "Đã xử lý", className: "bg-lua/15 text-lua" },
};

type FilterKey = "all" | "urgent" | "needs_support" | "handled";

export function SosReportList({ reports }: { reports: SosReport[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts = useMemo(
    () => ({
      all: reports.length,
      urgent: reports.filter((r) => r.status === "urgent").length,
      needs_support: reports.filter((r) => r.status === "needs_support").length,
      handled: reports.filter((r) => r.status === "handled").length,
    }),
    [reports],
  );

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: `Tất cả (${counts.all})` },
    { key: "urgent", label: `🔴 Khẩn cấp (${counts.urgent})` },
    { key: "needs_support", label: `🟠 Cần hỗ trợ (${counts.needs_support})` },
    { key: "handled", label: `🟢 Đã xử lý (${counts.handled})` },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              filter === item.key ? "border-son text-son" : "border-lineStrong text-inkMid hover:border-son hover:text-son"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[14px] border-2 border-dashed border-lineStrong bg-paperMid p-10 text-center text-sm text-inkMid">
          Không có báo cáo nào ở trạng thái này.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((report) => {
            const status = statusLabels[report.status] ?? { label: report.status, className: "bg-inkSoft/15 text-inkSoft" };
            return (
              <div key={report.id} className="overflow-hidden rounded-[14px] border border-line bg-white">
                {report.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={report.photo_url} alt="" className="h-32 w-full object-cover" />
                ) : null}
                <div className="p-4">
                  <span className={`rounded-[4px] px-2 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
                  <h3 className="mt-2 font-serif text-base font-semibold text-chamDeep">{report.location_text}</h3>
                  {report.description ? <p className="mt-1 line-clamp-2 text-xs text-inkMid">{report.description}</p> : null}
                  {report.needs?.length ? <p className="mt-2 text-xs font-semibold text-sky">{report.needs.join(", ")}</p> : null}
                  <p className="mt-2 text-[11px] text-inkSoft">{datetime.format(new Date(report.created_at))}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
