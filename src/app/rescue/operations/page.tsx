import { ModulePage } from "@/components/module-page";
import { requirePageRole } from "@/lib/auth/server";

export default async function RescueOperationsPage() {
  await requirePageRole(["rescue_team", "admin"], "/rescue/operations");
  return <ModulePage eyebrow="Role: rescue_team" title="Điều phối cứu trợ" description="Chỉ tài khoản cứu trợ đã được Admin kích hoạt mới truy cập được." items={["Nhiệm vụ SOS", "Cập nhật trạng thái available/en-route/busy", "Nguồn lực", "Khu vực hoạt động"]} />;
}
