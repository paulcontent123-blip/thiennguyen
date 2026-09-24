"use client";

import { useEffect, useState } from "react";

const currency = new Intl.NumberFormat("vi-VN");

type Props = {
  receivedAmount: number;
  targetAmount: number;
  percent: number;
  remainingDays: number | null;
  canDonate: boolean;
  disabledReason: string;
};

// Thanh cố định ở đáy màn hình điện thoại. Nút mở đúng hộp thoại ủng hộ có sẵn trong cột bên;
// thanh tự ẩn khi nút ủng hộ gốc đang hiện trên màn hình để không trùng lặp.
export function MobileDonateBar({ receivedAmount, targetAmount, percent, remainingDays, canDonate, disabledReason }: Props) {
  const [triggerVisible, setTriggerVisible] = useState(false);

  useEffect(() => {
    const trigger = document.getElementById("donation-trigger");
    if (!trigger || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setTriggerVisible(entry.isIntersecting), { threshold: 0.6 });
    observer.observe(trigger);
    return () => observer.disconnect();
  }, []);

  if (triggerVisible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(30,36,56,0.08)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[640px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[15px] font-bold text-son">
            {currency.format(receivedAmount)}₫ <span className="text-[11px] font-normal text-inkSoft">/ {currency.format(targetAmount)}₫</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-paperDeep"><div className="h-full rounded-full bg-son" style={{ width: `${percent}%` }} /></div>
          <div className="mt-1 text-[11px] text-inkSoft">{percent}% mục tiêu{remainingDays !== null ? ` · còn ${remainingDays} ngày` : ""}</div>
        </div>
        <button
          type="button"
          disabled={!canDonate}
          title={!canDonate ? disabledReason : undefined}
          onClick={() => document.getElementById("donation-trigger")?.click()}
          className="shrink-0 rounded-[40px] bg-son px-5 py-3 text-sm font-bold text-white transition hover:bg-son/90 disabled:cursor-not-allowed disabled:bg-inkSoft/20 disabled:text-inkSoft"
        >
          {canDonate ? "♥ Ủng hộ ngay" : "Chưa nhận ủng hộ"}
        </button>
      </div>
    </div>
  );
}
