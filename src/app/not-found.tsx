import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Không tìm thấy trang | Thiện Nguyện",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-[75vh] bg-paper">
      <SiteHeader />
      <section className="mx-auto flex max-w-2xl flex-col items-center px-5 py-20 text-center sm:px-7 sm:py-28">
        <div className="rounded-full bg-son/10 px-4 py-2 text-sm font-bold text-son">404 · Không tìm thấy trang</div>
        <p className="mt-8 font-mono text-7xl font-bold leading-none text-chamDeep/10 sm:text-8xl">404</p>
        <h1 className="mt-5 font-serif text-3xl font-semibold leading-tight text-chamDeep sm:text-4xl">
          Nội dung bạn tìm kiếm không tồn tại
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-inkMid">
          Đường dẫn có thể đã thay đổi, nội dung đã được ẩn hoặc bạn chưa có quyền truy cập.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="button-primary">Về trang chủ</Link>
          <Link href="/campaigns" className="button-secondary">Xem chiến dịch</Link>
        </div>
      </section>
    </main>
  );
}
