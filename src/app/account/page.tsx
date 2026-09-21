import { ModulePage } from "@/components/module-page";
import { requireAuthenticatedPage } from "@/lib/auth/server";

export default async function AccountPage() {
  await requireAuthenticatedPage("/account");
  return <ModulePage eyebrow="Authenticated" title="Tài khoản của bạn" description="Trang được bảo vệ cho mọi người dùng đã đăng nhập." items={["Thông tin hồ sơ", "Lịch sử hoạt động", "Thông báo", "Đăng xuất và quản lý phiên"]} />;
}
