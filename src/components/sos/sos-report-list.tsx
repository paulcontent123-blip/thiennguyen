import { TEAM_PROGRESS, type SosTeamResponse } from "@/lib/sos/team-progress";

type SosReport = {
  id: string;
  location_text: string;
  description: string | null;
  needs: string[];
  status: string;
  photo_url: string | null;
  created_at: string;
  team_responses?: SosTeamResponse[];
};

const datetime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const statusLabels: Record<string, { label: string; className: string }> = {
  urgent: { label: "Khẩn cấp", className: "bg-son/15 text-son" },
  needs_support: { label: "Cần hỗ trợ", className: "bg-nghe/15 text-ngheDeep" },
  handled: { label: "Đã xử lý", className: "bg-lua/15 text-lua" },
};

export function SosReportList({ reports }: { reports: SosReport[] }) {
  const filtered = reports;

  return (
    <div>
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
                  {report.team_responses?.length ? (
                    <div className="mt-3 rounded-[8px] bg-paper p-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-inkSoft">Đội cứu trợ phản hồi</p>
                      <ul className="mt-1.5 flex flex-col gap-1.5">
                        {report.team_responses.map((response, index) => {
                          const progress = TEAM_PROGRESS[response.progress] ?? TEAM_PROGRESS.acknowledged;
                          return (
                            <li key={`${response.team_name}-${index}`} className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                              <span className="font-semibold text-chamDeep">{response.member_kind === "team" ? "🚑" : "🙋"} {response.team_name}</span>
                              <span className={`rounded-[4px] px-1.5 py-0.5 font-bold ${progress.className}`}>{progress.icon} {progress.label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
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
