"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createDonationIntent } from "@/app/campaigns/[slug]/actions";
import {
  DONATION_MAX_AMOUNT,
  DONATION_MIN_AMOUNT,
  type DonationIntent,
} from "@/lib/donations/types";

const currency = new Intl.NumberFormat("vi-VN");
const presetAmounts = [100_000, 300_000, 500_000, 1_000_000];

type DonationDialogProps = {
  campaignId: string;
  campaignSlug: string;
  campaignTitle: string;
  campaignType: string;
  canDonate: boolean;
  disabledReason: string;
  defaultEmail?: string;
  isAuthenticated?: boolean;
};

export function DonationDialog({
  campaignId,
  campaignSlug,
  campaignTitle,
  campaignType,
  canDonate,
  disabledReason,
  defaultEmail = "",
  isAuthenticated = false,
}: DonationDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("300000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<DonationIntent | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  const numericAmount = Number(amount || 0);
  const allocation = useMemo(() => ({
    execution: Math.round(numericAmount * 0.9),
    operation: numericAmount - Math.round(numericAmount * 0.9),
  }), [numericAmount]);

  function close() {
    setOpen(false);
    setError(null);
    setCopied(null);
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    formData.set("campaignId", campaignId);
    formData.set("campaignSlug", campaignSlug);
    formData.set("amountVnd", amount);

    try {
      const result = await createDonationIntent(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setIntent(result.intent);
    } catch {
      setError("Không thể kết nối tới hệ thống tạo giao dịch. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("Trình duyệt không cho phép sao chép tự động.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => canDonate && setOpen(true)}
        disabled={!canDonate}
        title={!canDonate ? disabledReason : undefined}
        className="mb-2 w-full rounded-[40px] bg-son px-4 py-3 text-sm font-bold text-white transition hover:bg-son/90 disabled:cursor-not-allowed disabled:bg-inkSoft/20 disabled:text-inkSoft"
      >
        {canDonate ? "♥ Ủng hộ ngay" : `♥ ${disabledReason}`}
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
                aria-label={`Ủng hộ ${campaignTitle}`}
                className="relative max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-[16px] bg-white p-6 shadow-modal sm:p-7"
              >
                <button type="button" onClick={close} aria-label="Đóng" className="absolute right-5 top-4 text-2xl text-inkSoft hover:text-son">×</button>

                {intent ? (
                  <DonationPaymentStep
                    intent={intent}
                    copied={copied}
                    isAuthenticated={isAuthenticated}
                    onCopy={copyValue}
                    onClose={close}
                    onCreateAnother={() => {
                      setIntent(null);
                      setError(null);
                    }}
                  />
                ) : (
                  <>
                    <p className="eyebrow">VietQR động</p>
                    <h2 className="mt-2 pr-8 font-serif text-2xl font-semibold text-chamDeep">Ủng hộ chiến dịch</h2>
                    <p className="mt-1 text-sm leading-6 text-inkMid">{campaignTitle}</p>

                    <form action={handleSubmit} className="mt-5 space-y-5">
                      {error ? <p className="rounded-[8px] bg-son/10 px-3 py-2.5 text-sm text-son">{error}</p> : null}

                      <fieldset>
                        <legend className="text-sm font-bold text-chamDeep">Chọn số tiền</legend>
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {presetAmounts.map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setAmount(String(value))}
                              className={`rounded-[8px] border px-3 py-2.5 text-sm font-bold transition ${Number(amount) === value ? "border-son bg-son/5 text-son" : "border-line text-chamDeep hover:border-son"}`}
                            >
                              {currency.format(value)}đ
                            </button>
                          ))}
                        </div>
                        <label className="mt-3 grid gap-1 text-sm font-semibold text-chamDeep">
                          Số tiền khác (VND)
                          <input
                            name="amountDisplay"
                            inputMode="numeric"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, "").slice(0, 11))}
                            min={DONATION_MIN_AMOUNT}
                            max={DONATION_MAX_AMOUNT}
                            required
                            className="rounded-[8px] border border-line px-4 py-3 font-mono font-normal outline-none focus:border-son"
                          />
                          <span className="text-xs font-normal text-inkSoft">{numericAmount ? `${currency.format(numericAmount)}đ` : "Tối thiểu 10.000đ"}</span>
                        </label>
                      </fieldset>

                      {campaignType === "direct" && numericAmount >= DONATION_MIN_AMOUNT ? (
                        <div className="rounded-[10px] border border-line bg-paper p-3 text-xs">
                          <div className="mb-2 font-bold text-chamDeep">Phân bổ dự kiến 90/10</div>
                          <div className="flex h-2 overflow-hidden rounded-full"><span className="w-[90%] bg-son" /><span className="w-[10%] bg-nghe" /></div>
                          <div className="mt-2 flex justify-between gap-3"><span className="text-son">Thực thi: {currency.format(allocation.execution)}đ</span><span className="text-ngheDeep">Vận hành: {currency.format(allocation.operation)}đ</span></div>
                        </div>
                      ) : null}

                      {campaignType !== "direct" ? (
                        <p className="rounded-[10px] border border-sky/20 bg-skySoft p-3 text-xs leading-5 text-inkMid">Khoản ủng hộ được chuyển thẳng đến tài khoản của tổ chức/đối tác thụ hưởng. Nền tảng không giữ tiền.</p>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                          Tên người ủng hộ (không bắt buộc)
                          <input name="donorName" maxLength={120} placeholder="Nguyễn Văn A" className="rounded-[8px] border border-line px-4 py-3 font-normal outline-none focus:border-son" />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                          Email nhận biên nhận
                          <input name="receiptEmail" type="email" defaultValue={defaultEmail} maxLength={254} required placeholder="ban@example.com" className="rounded-[8px] border border-line px-4 py-3 font-normal outline-none focus:border-son" />
                        </label>
                      </div>

                      <button type="submit" disabled={loading || numericAmount < DONATION_MIN_AMOUNT || numericAmount > DONATION_MAX_AMOUNT} className="button-primary w-full disabled:cursor-wait disabled:opacity-50">
                        {loading ? "Đang tạo giao dịch…" : "Tạo mã VietQR"}
                      </button>
                      <p className="text-center text-[11px] leading-5 text-inkSoft">Hệ thống chỉ ghi nhận thành công sau khi webhook ngân hàng đối soát đúng tài khoản, số tiền và mã giao dịch.</p>
                    </form>
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function DonationPaymentStep({
  intent,
  copied,
  isAuthenticated,
  onCopy,
  onClose,
  onCreateAnother,
}: {
  intent: DonationIntent;
  copied: string | null;
  isAuthenticated: boolean;
  onCopy: (label: string, value: string) => Promise<void>;
  onClose: () => void;
  onCreateAnother: () => void;
}) {
  const expiresAt = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(intent.expiresAt));
  return (
    <div>
      <p className="eyebrow">Giao dịch đang chờ</p>
      <h2 className="mt-2 font-serif text-2xl font-semibold text-chamDeep">Quét QR để chuyển khoản</h2>
      <p className="mt-1 text-sm leading-6 text-inkMid">Không sửa số tiền hoặc nội dung chuyển khoản để hệ thống có thể đối soát tự động.</p>

      <div className="mt-5 grid gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div className="mx-auto rounded-[12px] border border-line bg-white p-2 shadow-card">
          <Image src={intent.qrUrl} width={204} height={204} alt={`VietQR ${intent.txRef}`} className="h-[204px] w-[204px] object-contain" />
        </div>
        <div className="space-y-2">
          <PaymentRow label="Số tiền" value={`${currency.format(intent.amountVnd)}đ`} copy={() => onCopy("amount", String(intent.amountVnd))} copied={copied === "amount"} />
          <PaymentRow label="Ngân hàng" value={intent.bankId} />
          <PaymentRow label="Số tài khoản" value={intent.accountNo} copy={() => onCopy("account", intent.accountNo)} copied={copied === "account"} />
          <PaymentRow label="Tên tài khoản" value={intent.accountName} />
          <PaymentRow label="Nội dung" value={intent.transferDescription} copy={() => onCopy("description", intent.transferDescription)} copied={copied === "description"} />
        </div>
      </div>

      <div className="mt-5 rounded-[10px] bg-ngheXsoft px-4 py-3 text-sm leading-6 text-ngheDeep">
        Mã <strong>{intent.txRef}</strong> có hiệu lực đến {expiresAt}. Trạng thái hiện tại: <strong>Chờ ngân hàng xác nhận</strong>.
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {isAuthenticated ? <Link href="/account" className="button-primary flex-1 text-center">Xem lịch sử giao dịch</Link> : <button type="button" onClick={onClose} className="button-primary flex-1">Đóng</button>}
        <button type="button" onClick={onCreateAnother} className="flex-1 rounded-[40px] border border-lineStrong px-4 py-2.5 text-sm font-bold text-chamDeep hover:border-son hover:text-son">Tạo giao dịch khác</button>
      </div>
    </div>
  );
}

function PaymentRow({ label, value, copy, copied = false }: { label: string; value: string; copy?: () => void; copied?: boolean }) {
  return (
    <div className="rounded-[8px] bg-paper px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-inkSoft">{label}</div>
      <div className="mt-0.5 flex items-start justify-between gap-2">
        <strong className="break-all text-sm text-chamDeep">{value}</strong>
        {copy ? <button type="button" onClick={copy} className="shrink-0 text-[11px] font-bold text-sky hover:underline">{copied ? "Đã chép" : "Sao chép"}</button> : null}
      </div>
    </div>
  );
}
