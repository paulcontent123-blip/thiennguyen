export default function Loading() {
  return (
    <main className="min-h-screen bg-paper" aria-busy="true" aria-live="polite">
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-5 sm:px-7">
          <div className="h-7 w-36 animate-pulse rounded-full bg-chamSoft" />
          <div className="hidden items-center gap-3 sm:flex">
            <div className="h-4 w-16 animate-pulse rounded-full bg-chamSoft" />
            <div className="h-4 w-20 animate-pulse rounded-full bg-chamSoft" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-chamSoft" />
          </div>
          <div className="h-10 w-24 animate-pulse rounded-full bg-chamSoft" />
        </div>
      </div>

      <section className="mx-auto max-w-[1160px] px-5 py-16 sm:px-7 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="h-4 w-28 animate-pulse rounded-full bg-son/15" />
          <div className="mt-5 h-10 w-4/5 animate-pulse rounded-lg bg-chamSoft sm:h-12" />
          <div className="mt-3 h-5 w-full animate-pulse rounded bg-chamSoft" />
          <div className="mt-2 h-5 w-2/3 animate-pulse rounded bg-chamSoft" />

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="h-44 animate-pulse rounded-[14px] border border-line bg-white shadow-card" />
            <div className="h-44 animate-pulse rounded-[14px] border border-line bg-white shadow-card" />
          </div>

          <div className="mt-8 flex items-center justify-center gap-3 text-sm text-inkSoft">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-son/20 border-t-son" />
            <span>Đang tải dữ liệu…</span>
          </div>
        </div>
      </section>
    </main>
  );
}
