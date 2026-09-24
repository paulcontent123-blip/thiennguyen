"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function MobileNav({ links }: { links: readonly (readonly [string, string])[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Đóng menu" : "Mở menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((current) => !current)}
        className="grid h-10 w-10 place-items-center rounded-full border border-lineStrong text-lg text-chamDeep transition hover:border-son hover:text-son"
      >
        <span aria-hidden>{open ? "✕" : "☰"}</span>
      </button>
      {open ? (
        <div id="mobile-nav-panel" className="absolute inset-x-0 top-full max-h-[calc(100vh-64px)] overflow-y-auto border-b border-line bg-white shadow-modal">
          <ul className="mx-auto max-w-[1160px] px-4 py-2">
            {links.map(([label, href]) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                  className={`block rounded-[8px] px-3 py-3 text-[15px] font-bold transition hover:bg-paper hover:text-son ${pathname === href ? "text-son" : "text-inkMid"}`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
