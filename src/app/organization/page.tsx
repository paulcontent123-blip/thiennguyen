import { ModulePage } from "@/components/module-page";

export default function OrganizationPage() {
  return <ModulePage eyebrow="Role: org" title="Cổng tổ chức" description="Tài khoản người đại diện pháp luật quản lý giấy phép, campaign và hồ sơ giải ngân." items={["Upload giấy phép hoạt động", "Theo dõi trạng thái xác minh", "Campaign CRUD", "Chứng từ và approval của người đại diện"]} />;
}
