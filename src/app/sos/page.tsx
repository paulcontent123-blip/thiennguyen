import { SiteHeader } from "@/components/site-header";
import { SosReportForm } from "@/components/sos/sos-report-form";
import { getCurrentAuth } from "@/lib/auth/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const datetime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const statusLabels: Record<string, { label: string; className: string }> = {
  urgent: { label: "Khẩn cấp", className: "bg-son/15 text-son" },
  needs_support: { label: "Cần hỗ trợ", className: "bg-nghe/15 text-ngheDeep" },
  handled: { label: "Đã xử lý", className: "bg-lua/15 text-lua" },
};

async function getSosReports() {
  if (!hasSupabaseEnv()) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("sos_reports")
    .select("id, location_text, description, needs, status, photo_url, created_at")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export default async function SosPage() {
  const [{ user }, reports] = await Promise.all([getCurrentAuth(), getSosReports()]);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-[1160px] px-7 py-10">
        <p className="eyebrow">Cứu trợ khẩn cấp</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-chamDeep">Bản đồ SOS</h1>
        <p className="mt-3 max-w-2xl leading-7 text-inkMid">
          Gửi tín hiệu SOS khi cần cứu trợ khẩn cấp, hoặc xem các báo cáo đang chờ hỗ trợ. Hiển thị dạng danh sách — bản đồ trực quan sẽ có ở đợt sau.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            <h2 className="mb-4 font-serif text-xl font-semibold text-chamDeep">{reports.length} báo cáo gần đây</h2>
            {reports.length === 0 ? (
              <div className="rounded-[14px] border-2 border-dashed border-lineStrong bg-paperMid p-10 text-center text-sm text-inkMid">
                Chưa có báo cáo SOS nào.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {reports.map((report) => {
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

          <aside>
            <SosReportForm isAuthenticated={Boolean(user)} />
          </aside>
        </div>
      </section>
    </main>
  );
}
