import { SiteHeader } from "@/components/site-header";
import { RescueOperationsDashboard } from "@/components/rescue/rescue-operations-dashboard";
import { requirePageRole } from "@/lib/auth/server";

export default async function RescueOperationsPage() {
  const { supabase, user, role } = await requirePageRole(["rescue_team", "admin"], "/rescue/operations");

  const { data: team } = await supabase
    .from("rescue_teams")
    .select("id, name, resource_types, province, radius_km, latitude, longitude, status")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: alerts, error: alertsError } = team
    ? await supabase
        .from("sos_team_alerts")
        .select("id, sos_report_id, distance_km, acknowledged_at, response_status, response_note, responded_at, created_at")
        .eq("rescue_team_id", team.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [], error: null };
  if (alertsError) console.warn("Rescue SOS alerts unavailable", alertsError.code);

  const reportIds = (alerts ?? []).map((alert) => alert.sos_report_id);
  const { data: reports } = reportIds.length
    ? await supabase
        .from("sos_reports")
        .select("id, location_text, description, needs, status, created_at")
        .in("id", reportIds)
        .in("status", ["urgent", "needs_support"])
    : { data: [] };
  const reportsById = new Map((reports ?? []).map((report) => [report.id, report]));
  const tasks = (alerts ?? []).flatMap((alert) => {
    const report = reportsById.get(alert.sos_report_id);
    return report ? [{
      ...report,
      alertId: alert.id,
      distanceKm: Number(alert.distance_km),
      acknowledgedAt: alert.acknowledged_at,
      responseStatus: alert.response_status,
      responseNote: alert.response_note,
    }] : [];
  });

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-[1160px] px-7 py-10">
        <p className="eyebrow">Role: {role}</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-chamDeep">Điều phối cứu trợ</h1>
        <p className="mt-3 max-w-2xl leading-7 text-inkMid">
          Chỉ tài khoản cứu trợ đã được Admin kích hoạt (hoặc Admin) mới truy cập được trang này.
        </p>

        <div className="mt-8">
          <RescueOperationsDashboard team={team ?? null} tasks={tasks} canEdit={role === "rescue_team"} />
        </div>
      </section>
    </main>
  );
}
