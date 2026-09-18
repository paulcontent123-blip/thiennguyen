import { ModulePage } from "@/components/module-page";

export default function CampaignsPage() {
  return <ModulePage eyebrow="Public" title="Chiến dịch" description="Danh sách campaign công khai sẽ được kết nối Supabase ở sprint tiếp theo." items={["Tìm kiếm và lọc", "Chi tiết campaign", "Hồ sơ tổ chức", "Cashflow Tree"]} />;
}
