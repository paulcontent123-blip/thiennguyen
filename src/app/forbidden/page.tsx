import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
        <div className="rounded-full bg-son/10 px-4 py-2 text-sm font-bold text-son">403 · Không có quyền truy cập</div>
        <h1 className="mt-6 font-serif text-4xl font-semibold text-chamDeep">Tài khoản không được phép mở màn hình này</h1>
        <p className="mt-4 max-w-xl leading-7 text-inkMid">
          Hệ thống đã xác định tài khoản của bạn không thuộc nhóm quyền được cấp cho khu vực vừa truy cập.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/account" className="button-primary">Về tài khoản</Link>
          <Link href="/" className="rounded-[40px] border border-lineStrong px-5 py-2.5 text-sm font-bold text-chamDeep">Về trang chủ</Link>
        </div>
      </section>
    </main>
  );
}
