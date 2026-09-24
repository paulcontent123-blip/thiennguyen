import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";

export default async function AdminSosListPage() {
  const { supabase } = await requirePageRole(["admin"], "/admin/sos");
  const { data: reports, error } = await supabase.from("sos_reports")
    .select("id, location_text, status, needs, created_at, sos_team_alerts(response_status)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  return (
    <main className="min-h-screen bg-paper px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin" className="text-sm font-semibold text-sky hover:underline">← Admin Portal</Link>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-chamDeep">Điều phối SOS</h1>
        <p className="mt-2 text-sm text-inkMid">Mở một báo cáo để xem xe gần nhất, cảnh báo tình nguyện viên hoặc tạo chiến dịch khẩn cấp.</p>
        <div className="mt-6 space-y-3">
          {(reports ?? []).map((report) => (
            <Link key={report.id} href={`/admin/sos/${report.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-white p-4 hover:border-son">
              <span><strong className="text-chamDeep">{report.location_text}</strong><span className="block text-xs text-inkSoft">{report.needs.join(" · ")} · {new Date(report.created_at).toLocaleString("vi-VN")}</span></span>
              <span className="flex items-center gap-2 text-xs font-bold text-son">{(report.status === "urgent" || report.status === "needs_support") && report.sos_team_alerts.some((alert) => alert.response_status === "completed") ? <span className="rounded-full bg-lua/15 px-2 py-0.5 text-lua">Đội báo xong</span> : report.sos_team_alerts.some((alert) => alert.response_status) ? <span className="rounded-full bg-sky/15 px-2 py-0.5 text-sky">Có cập nhật</span> : null}{report.status} →</span>
            </Link>
          ))}
          {reports?.length === 0 ? <p className="rounded-[10px] border border-line bg-white p-6 text-sm text-inkSoft">Chưa có báo cáo SOS.</p> : null}
        </div>
      </div>
    </main>
  );
}
