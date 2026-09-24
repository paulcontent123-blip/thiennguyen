"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DonationHistoryItem } from "@/lib/donations/types";

const currency = new Intl.NumberFormat("vi-VN");
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

export function DonationReceiptModal({ item, onClose }: { item: DonationHistoryItem; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const receipt = item.receipt;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  if (!mounted || !receipt) return null;

  async function copyTxRef() {
    try {
      await navigator.clipboard.writeText(item.txRef);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const rows: [string, string][] = [
    ["Mã giao dịch", item.txRef],
    ["Thời điểm ghi nhận", dateTime.format(new Date(item.completedAt ?? item.createdAt))],
    ["Người ủng hộ", receipt.donorName || "Ẩn danh"],
    ["Email nhận biên nhận", receipt.receiptEmail],
    ["Chiến dịch", item.campaignTitle],
    ["Đơn vị thụ hưởng", receipt.ownerName ?? "—"],
    ["Loại chiến dịch", receipt.campaignTypeLabel],
    ["Tài khoản nhận", `${receipt.accountName} · ${receipt.bankId} ${receipt.accountNoMasked}`],
    ["Nội dung chuyển khoản", receipt.transferDescription],
  ];

  return createPortal(
    <div
      className="receipt-overlay fixed inset-0 z-[80] flex items-center justify-center bg-ink/55 px-4 py-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Biên nhận giao dịch" className="receipt-print relative max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-[16px] bg-white p-6 shadow-modal sm:p-7">
        <button type="button" onClick={onClose} aria-label="Đóng" className="receipt-hide-on-print absolute right-5 top-4 text-2xl text-inkSoft hover:text-son">×</button>
        <h2 className="pr-8 font-serif text-xl font-semibold text-chamDeep">Biên nhận giao dịch</h2>
        <p className="mt-1 text-sm text-inkMid">Biên nhận điện tử của giao dịch đã được Admin đối soát khớp sao kê ngân hàng.</p>

        <div className="mt-5 rounded-[10px] border border-line bg-paper p-4">
          <div className="text-center font-serif text-[15px] font-semibold text-chamDeep">THIỆN NGUYỆN · BIÊN NHẬN ĐIỆN TỬ</div>
          <dl className="mt-3 divide-y divide-line text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2">
                <dt className="shrink-0 text-inkSoft">{label}</dt>
                <dd className="break-words text-right font-semibold text-chamDeep">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 pt-3">
              <dt className="font-bold text-chamDeep">SỐ TIỀN ĐÃ GHI NHẬN</dt>
              <dd className="font-mono text-lg font-bold text-son">{currency.format(receipt.receivedAmountVnd)}đ</dd>
            </div>
          </dl>
          {receipt.receivedAmountVnd !== item.amountVnd ? (
            <p className="mt-2 text-xs text-inkSoft">Số tiền bạn đã khai báo khi tạo giao dịch: {currency.format(item.amountVnd)}đ.</p>
          ) : null}
        </div>

        <div className="receipt-hide-on-print mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="button-primary !py-2.5 text-sm">🖨 In / Lưu PDF</button>
          <button type="button" onClick={copyTxRef} className="button-secondary !py-2.5 text-sm">{copied ? "✓ Đã chép mã" : "⧉ Sao chép mã giao dịch"}</button>
        </div>
        <p className="receipt-hide-on-print mt-3 text-xs leading-5 text-inkSoft">Dùng &ldquo;In / Lưu PDF&rdquo; rồi chọn &ldquo;Lưu dưới dạng PDF&rdquo; trong hộp thoại in của trình duyệt để lưu bản điện tử.</p>
      </div>
    </div>,
    document.body,
  );
}
