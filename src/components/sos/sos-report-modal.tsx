"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SosReportForm } from "@/components/sos/sos-report-form";

export function SosReportModal({ isAuthenticated, triggerClassName, triggerLabel }: { isAuthenticated: boolean; triggerClassName: string; triggerLabel: string }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/55 px-4 py-6"
              onClick={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Phát tín hiệu SOS"
                className="relative max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-[16px] bg-white p-6 shadow-modal sm:p-7"
              >
                <button type="button" onClick={close} aria-label="Đóng" className="absolute right-5 top-4 text-2xl text-inkSoft hover:text-son">×</button>
                <SosReportForm isAuthenticated={isAuthenticated} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
