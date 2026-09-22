import { SiteHeader } from "@/components/site-header";
import { RescueOperationsDashboard } from "@/components/rescue/rescue-operations-dashboard";
import { requirePageRole } from "@/lib/auth/server";

export default async function RescueOperationsPage() {
  const { supabase, user, role } = await requirePageRole(["rescue_team", "admin"], "/rescue/operations");

  const [{ data: team }, { data: tasks }] = await Promise.all([
    supabase
      .from("rescue_teams")
      .select("name, resource_types, province, radius_km, latitude, longitude, status")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("sos_reports")
      .select("id, location_text, description, needs, status, created_at")
      .in("status", ["urgent", "needs_support"])
      .order("status", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

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
          <RescueOperationsDashboard team={team ?? null} tasks={tasks ?? []} canEdit={role === "rescue_team"} />
        </div>
      </section>
    </main>
  );
}
