import Link from "next/link";
import { Suspense } from "react";
import { AuthControls } from "./auth-controls";
import { CreateCampaignModal } from "./create-campaign-modal";

const navLinks = [
  ["Ủng hộ", "/"],
  ["Khám phá", "/campaigns"],
  ["Bản đồ SOS", "/sos"],
  ["Nguồn lực", "/donate-items"],
  ["Minh bạch", "/transparency"],
  ["Đồng hành cùng quỹ", "/corporate"],
  ["Giới thiệu", "/introduction"],
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-[1160px] items-center gap-6 px-7 py-3.5">
        <Link href="/" className="flex items-center gap-2 whitespace-nowrap font-serif text-lg font-semibold text-chamDeep">
          <span className="text-xl">&#10084;</span> Thiện Nguyện
        </Link>
        <div className="flex flex-1 flex-wrap items-center gap-5 text-[13px] font-bold text-inkMid">
          {navLinks.map(([label, href]) => (
            <Link key={href} href={href} className="transition hover:text-son">
              {label}
            </Link>
          ))}
          <Link href="/admin" className="font-bold text-son transition hover:text-son/80">
            &#9881; Admin
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Suspense fallback={<div className="h-[38px] w-[92px]" />}>
            <AuthControls />
          </Suspense>
          <CreateCampaignModal />
        </div>
      </nav>
    </header>
  );
}
