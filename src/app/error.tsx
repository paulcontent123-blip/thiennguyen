"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application route error", error);
  }, [error]);

  return (
    <main className="flex min-h-[75vh] items-center bg-paper px-5 py-20 sm:px-7">
      <section className="mx-auto w-full max-w-2xl rounded-[14px] border border-line bg-white p-7 text-center shadow-card sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-son/10 text-2xl" aria-hidden="true">!</div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-son">Không thể tải nội dung</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-chamDeep">Đã xảy ra lỗi ngoài dự kiến</h1>
        <p className="mt-4 leading-7 text-inkMid">
          Dữ liệu có thể đang tạm thời gián đoạn. Bạn hãy thử tải lại nội dung hoặc quay về trang chủ.
        </p>
        {error.digest ? <p className="mt-3 text-xs text-inkSoft">Mã lỗi: {error.digest}</p> : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="button-primary">Thử lại</button>
          <Link href="/" className="button-secondary">Về trang chủ</Link>
        </div>
      </section>
    </main>
  );
}
