import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requirePageRole } from "@/lib/auth/server";

export default async function AdminSosLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["admin"], "/admin/sos");

  return (
    <div className="min-h-screen bg-paperMid lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <AdminSidebar active="sos" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
