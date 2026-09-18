import { SiteHeader } from "@/components/site-header";

export default function LoginPage() {
  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-[1160px] px-7 py-24 text-center text-sm text-inkSoft">
        Cửa sổ đăng nhập sẽ tự mở — nếu không thấy, hãy bấm &quot;Đăng nhập&quot; trên thanh menu.
      </section>
    </main>
  );
}
