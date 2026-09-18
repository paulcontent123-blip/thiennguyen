import { ModulePage } from "@/components/module-page";

export default function RescueApplyPage() {
  return <ModulePage eyebrow="Luồng riêng" title="Hồ sơ hoạt động cứu trợ" description="Gửi hồ sơ không tự kích hoạt tài khoản. Chỉ Admin xem xét và cấp quyền sau khi duyệt." items={["Thông tin cá nhân/đội", "Nguồn lực và địa bàn", "Tài liệu năng lực", "Trạng thái xét duyệt"]} />;
}
