"use client";

import { useMemo, useState } from "react";
import { SosMapLoader } from "@/components/sos/sos-map-loader";
import { SosReportList } from "@/components/sos/sos-report-list";
import type { SosTeamResponse } from "@/lib/sos/team-progress";

export type SosBoardReport = {
  id: string;
  location_text: string;
  description: string | null;
  needs: string[];
  status: string;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  team_responses?: SosTeamResponse[];
};

type FilterKey = "all" | "urgent" | "needs_support" | "handled";

const legend = [
  { label: "Khẩn cấp", className: "bg-son" },
  { label: "Cần hỗ trợ", className: "bg-nghe" },
  { label: "Đã xử lý", className: "bg-lua" },
] as const;

export function SosBoard({ reports }: { reports: SosBoardReport[] }) {
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

  const filtered = useMemo(() => (filter === "all" ? reports : reports.filter((r) => r.status === filter)), [filter, reports]);
  const mappedCount = filtered.filter((r) => r.latitude != null && r.longitude != null).length;

  const filters: { key: FilterKey; label: string; activeClass: string }[] = [
    { key: "all", label: `Tất cả (${counts.all})`, activeClass: "border-son bg-son text-white" },
    { key: "urgent", label: `🔴 Khẩn cấp (${counts.urgent})`, activeClass: "border-son bg-son text-white" },
    { key: "needs_support", label: `🟠 Cần hỗ trợ (${counts.needs_support})`, activeClass: "border-son bg-son text-white" },
    { key: "handled", label: `🟢 Đã xử lý (${counts.handled})`, activeClass: "border-son bg-son text-white" },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-full border-[1.5px] px-4 py-1.5 text-[13px] font-medium transition ${
              filter === item.key ? item.activeClass : "border-lineStrong bg-white text-inkMid hover:border-son hover:bg-son hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-inkSoft">📌 Zoom vào để xem chi tiết khu vực</span>
      </div>

      <div className="overflow-hidden rounded-[14px] shadow-[0_4px_20px_rgba(27,36,68,0.12)]">
        <SosMapLoader reports={filtered} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-inkMid">
        {legend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.className}`} />
            {item.label}
          </span>
        ))}
        <span className="ml-auto text-xs text-inkSoft">{mappedCount}/{filtered.length} báo cáo có toạ độ GPS</span>
      </div>

      <h2 className="mb-4 mt-10 font-serif text-xl font-semibold text-chamDeep">{filtered.length} báo cáo gần đây</h2>
      <SosReportList reports={filtered} />
    </div>
  );
}
