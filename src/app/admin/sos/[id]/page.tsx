import Link from "next/link";
import { notFound } from "next/navigation";
import { SosAdminDispatchPanel } from "@/components/admin/sos-admin-dispatch-panel";
import { requirePageRole } from "@/lib/auth/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminSosDetailPage({ params }: { params: { id: string } }) {
  const { supabase } = await requirePageRole(["admin"], `/admin/sos/${params.id}`);
  if (!UUID_PATTERN.test(params.id)) notFound();
  const { data: report, error: reportError } = await supabase.from("sos_reports")
    .select("id, location_text, description, needs, status, latitude, longitude, contact_phone, auto_close_on_team_complete, created_at")
    .eq("id", params.id).maybeSingle();
  if (reportError) throw new Error(reportError.message);
  if (!report) notFound();

  const [requestResult, linkResult, organizationsResult, offersResult, dispatchesResult, alertsResult] = await Promise.all([
    supabase.from("sos_campaign_requests")
      .select("id, title, target_amount, contact_email, status, review_note")
      .eq("sos_report_id", report.id).maybeSingle(),
    supabase.from("sos_campaign_links").select("campaign_id").eq("sos_report_id", report.id).maybeSingle(),
    supabase.from("organizations").select("id, name").eq("license_status", "approved").order("name"),
    supabase.rpc("get_nearby_sos_transport_offers", { p_sos_report_id: report.id }),
    supabase.from("sos_transport_dispatches")
      .select("id, offer_id, status, created_at, resource_offers(title, contact_name, contact_email, contact_phone)")
      .eq("sos_report_id", report.id).order("created_at", { ascending: false }),
    supabase.from("sos_team_alerts")
      .select("id, rescue_team_id, distance_km, source, acknowledged_at, response_status, response_note, responded_at, rescue_teams(name, member_kind)")
      .eq("sos_report_id", report.id).order("distance_km", { ascending: true }),
  ]);
  for (const result of [requestResult, linkResult, organizationsResult, offersResult, dispatchesResult, alertsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  return (
    <main className="min-h-screen bg-paper px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/sos" className="text-sm font-semibold text-sky hover:underline">← Danh sách SOS</Link>
        <SosAdminDispatchPanel
          report={report}
          request={requestResult.data ?? null}
          linkedCampaignId={linkResult.data?.campaign_id ?? null}
          organizations={organizationsResult.data ?? []}
          offers={offersResult.data ?? []}
          dispatches={dispatchesResult.data ?? []}
          alerts={alertsResult.data ?? []}
        />
      </div>
    </main>
  );
}
