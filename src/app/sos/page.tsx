import { SiteHeader } from "@/components/site-header";
import { RescueApplyModal } from "@/components/rescue/rescue-apply-modal";
import { SosBoard, type SosBoardReport } from "@/components/sos/sos-board";
import { SosReportModal } from "@/components/sos/sos-report-modal";
import { getCurrentAuth } from "@/lib/auth/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { SosTeamResponse } from "@/lib/sos/team-progress";

const teamStatusLabels: Record<string, { label: string; className: string }> = {
  available: { label: "Sẵn sàng", className: "bg-lua/15 text-lua" },
  en_route: { label: "Đang điều phối", className: "bg-sky/15 text-sky" },
  busy: { label: "Đang bận", className: "bg-nghe/15 text-ngheDeep" },
};

type PublicRescueTeam = {
  id: string;
  name: string;
  resource_types: string[];
  province: string | null;
  radius_km: number | null;
  status: string;
};

async function getSosReports(): Promise<SosBoardReport[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = createClient();
  const [{ data }, { data: responses }] = await Promise.all([
    supabase.rpc("get_public_sos_reports"),
    supabase.rpc("get_public_sos_team_responses"),
  ]);
  const byReport = new Map<string, SosTeamResponse[]>();
  for (const row of (responses ?? []) as (SosTeamResponse & { sos_report_id: string })[]) {
    byReport.set(row.sos_report_id, [
      ...(byReport.get(row.sos_report_id) ?? []),
      { team_name: row.team_name, member_kind: row.member_kind, progress: row.progress, updated_at: row.updated_at },
    ]);
  }
  return ((data ?? []) as SosBoardReport[]).map((report) => ({ ...report, team_responses: byReport.get(report.id) ?? [] }));
}

async function getActiveRescueTeams(): Promise<PublicRescueTeam[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = createClient();
  const { data } = await supabase.rpc("get_public_rescue_teams");
  return (data ?? []) as PublicRescueTeam[];
}

export default async function SosPage() {
  const [{ user }, reports, rescueTeams] = await Promise.all([getCurrentAuth(), getSosReports(), getActiveRescueTeams()]);
  const activeCount = reports.filter((report) => report.status !== "handled").length;

  return (
    <main className="min-h-screen bg-paper">
      <link rel="preconnect" href="https://server.arcgisonline.com" crossOrigin="" />
      <SiteHeader />

      <div className="bg-son py-2.5">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 px-7">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-white" />
            <span className="text-sm font-bold text-white">{activeCount} điểm SOS đang chờ xử lý</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <RescueApplyModal
              isAuthenticated={Boolean(user)}
              triggerClassName="rounded-full border border-white/40 bg-white/15 px-4 py-1.5 text-[13px] font-bold text-white transition hover:bg-white/25"
              triggerLabel="🚑 Gửi hồ sơ Đội cứu trợ"
            />
            <SosReportModal
              isAuthenticated={Boolean(user)}
              triggerClassName="rounded-full bg-white px-4 py-1.5 text-[13px] font-bold text-son transition hover:bg-white/90"
              triggerLabel="🆘 Phát tín hiệu SOS"
            />
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1160px] px-7 py-10">
        <p className="eyebrow">Cứu trợ khẩn cấp</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-chamDeep">Bản đồ SOS</h1>
        <p className="mt-3 max-w-2xl leading-7 text-inkMid">
          Gửi tín hiệu SOS khi cần cứu trợ khẩn cấp, hoặc xem các báo cáo đang chờ hỗ trợ trên bản đồ và danh sách.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <SosBoard reports={reports} />

          <aside className="flex flex-col gap-5">
            <div className="rounded-[14px] border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-chamDeep">🚑 Đội cứu trợ đã kích hoạt</span>
                <span className="text-xs font-bold text-lua">{rescueTeams.length} đội</span>
              </div>
              {rescueTeams.length === 0 ? (
                <p className="text-sm text-inkSoft">Chưa có đội cứu trợ nào được kích hoạt.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {rescueTeams.map((team) => {
                    const status = teamStatusLabels[team.status] ?? { label: team.status, className: "bg-inkSoft/15 text-inkSoft" };
                    return (
                      <div key={team.id} className="flex items-start justify-between gap-2 rounded-[8px] bg-paper px-3 py-2.5">
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-chamDeep">{team.name}</div>
                          <div className="mt-0.5 text-xs text-inkSoft">
                            {team.resource_types.join(" · ") || "Chưa khai báo"}
                            {team.province ? ` · ${team.province}` : ""}
                            {team.radius_km ? ` · bán kính ${team.radius_km}km` : ""}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-[4px] px-2 py-0.5 text-[11px] font-bold ${status.className}`}>{status.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <RescueApplyModal
                isAuthenticated={Boolean(user)}
                triggerClassName="button-secondary mt-3 block w-full text-center text-[13px]"
                triggerLabel="+ Gửi hồ sơ đăng ký"
              />
            </div>

            <div className="rounded-[14px] border-2 border-dashed border-son/30 bg-sonSoft p-5 text-center">
              <div className="text-2xl" aria-hidden="true">🆘</div>
              <h2 className="mt-2 font-serif text-base font-semibold text-chamDeep">Cần cứu trợ khẩn cấp?</h2>
              <p className="mt-1 text-xs leading-5 text-inkMid">Gửi vị trí, ảnh hiện trường và nhu cầu để đội cứu trợ nắm được tình hình ngay.</p>
              <div className="mt-3">
                <SosReportModal
                  isAuthenticated={Boolean(user)}
                  triggerClassName="button-primary w-full"
                  triggerLabel="🚨 Phát tín hiệu SOS ngay"
                />
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
