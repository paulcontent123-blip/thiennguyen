"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createDonationIntent, createDonationIntentVnpay } from "@/app/campaigns/[slug]/actions";
import { allocateWalletToCampaign } from "@/app/wallet/actions";
import {
  DONATION_MAX_AMOUNT,
  DONATION_MIN_AMOUNT,
  type DonationIntent,
} from "@/lib/donations/types";
import { WALLET_MIN_TOPUP, type WalletAllocationResult } from "@/lib/wallet/types";
import { createClient } from "@/lib/supabase/client";

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
  const [vnpayLoading, setVnpayLoading] = useState(false);
  const [showVietQrFallback, setShowVietQrFallback] = useState(false);
  const [method, setMethod] = useState<"transfer" | "wallet">("transfer");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletAmount, setWalletAmount] = useState("100000");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletSuccess, setWalletSuccess] = useState<{ txRef: string; balanceAfterVnd: number; message: string } | null>(null);
  const [walletRequestId, setWalletRequestId] = useState("");

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

  useEffect(() => {
    if (!open || method !== "wallet" || !isAuthenticated || walletBalance !== null) return;
    let cancelled = false;
    createClient()
      .from("wallet_accounts")
      .select("available_balance_vnd")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setWalletBalance(Number(data?.available_balance_vnd ?? 0));
      });
    return () => {
      cancelled = true;
    };
  }, [open, method, isAuthenticated, walletBalance]);

  const numericAmount = Number(amount || 0);
  const numericWalletAmount = Number(walletAmount || 0);
  const allocation = useMemo(() => ({
    execution: Math.round(numericAmount * 0.9),
    operation: numericAmount - Math.round(numericAmount * 0.9),
  }), [numericAmount]);

  function close() {
    setOpen(false);
    setError(null);
    setCopied(null);
    setWalletSuccess(null);
    setWalletError(null);
  }

  async function handleWalletSubmit() {
    setWalletLoading(true);
    setWalletError(null);
    const requestId = walletRequestId || window.crypto.randomUUID();
    if (!walletRequestId) setWalletRequestId(requestId);

    const formData = new FormData();
    formData.set("campaignId", campaignId);
    formData.set("amountVnd", walletAmount);
    formData.set("requestId", requestId);

    try {
      const result: WalletAllocationResult = await allocateWalletToCampaign(formData);
      if (!result.ok) {
        setWalletError(result.message);
        return;
      }
      setWalletSuccess({ txRef: result.txRef, balanceAfterVnd: result.balanceAfterVnd, message: result.message });
      setWalletBalance(result.balanceAfterVnd);
      setWalletRequestId(window.crypto.randomUUID());
    } catch {
      setWalletError("Không thể phân bổ từ ví lúc này. Vui lòng thử lại.");
    } finally {
      setWalletLoading(false);
    }
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

  async function handleVnpaySubmit(formData: FormData) {
    setVnpayLoading(true);
    setError(null);
    formData.set("campaignId", campaignId);
    formData.set("campaignSlug", campaignSlug);
    formData.set("amountVnd", amount);

    try {
      const result = await createDonationIntentVnpay(formData);
      if (!result.ok) {
        setError(result.message);
        setVnpayLoading(false);
        return;
      }
      window.location.href = result.redirectUrl;
    } catch {
      setError("Không thể kết nối tới cổng VNPAY. Vui lòng thử lại hoặc dùng VietQR.");
      setVnpayLoading(false);
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
        id="donation-trigger"
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
                ) : walletSuccess ? (
                  <div>
                    <p className="eyebrow">Đã ủng hộ từ ví</p>
                    <h2 className="mt-2 font-serif text-2xl font-semibold text-chamDeep">Cảm ơn bạn!</h2>
                    <p className="mt-1 text-sm leading-6 text-inkMid">{campaignTitle}</p>
                    <div className="mt-5 rounded-[10px] border border-lua/30 bg-lua/10 px-4 py-3 text-sm leading-6 text-lua">
                      {walletSuccess.message}
                    </div>
                    <dl className="mt-4 divide-y divide-line text-sm">
                      <div className="flex justify-between gap-4 py-2"><dt className="text-inkSoft">Mã giao dịch</dt><dd className="font-mono font-semibold text-chamDeep">{walletSuccess.txRef}</dd></div>
                      <div className="flex justify-between gap-4 py-2"><dt className="text-inkSoft">Số dư ví còn lại</dt><dd className="font-mono font-semibold text-chamDeep">{currency.format(walletSuccess.balanceAfterVnd)}đ</dd></div>
                    </dl>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <Link href="/account" className="button-primary flex-1 text-center">Xem lịch sử giao dịch</Link>
                      <button type="button" onClick={close} className="flex-1 rounded-[40px] border border-lineStrong px-4 py-2.5 text-sm font-bold text-chamDeep hover:border-son hover:text-son">Đóng</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex gap-2 rounded-[40px] bg-paper p-1">
                      <button
                        type="button"
                        onClick={() => setMethod("transfer")}
                        className={`flex-1 rounded-[40px] py-2 text-sm font-bold transition ${method === "transfer" ? "bg-white text-son shadow-card" : "text-inkMid"}`}
                      >
                        💵 Chuyển khoản
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod("wallet")}
                        className={`flex-1 rounded-[40px] py-2 text-sm font-bold transition ${method === "wallet" ? "bg-white text-son shadow-card" : "text-inkMid"}`}
                      >
                        💳 Từ ví
                      </button>
                    </div>

                    {method === "wallet" ? (
                      <div>
                        <p className="eyebrow">Ví Thiện Nguyện</p>
                        <h2 className="mt-2 pr-8 font-serif text-2xl font-semibold text-chamDeep">Ủng hộ từ ví</h2>
                        <p className="mt-1 text-sm leading-6 text-inkMid">{campaignTitle}</p>

                        {!isAuthenticated ? (
                          <div className="mt-5 rounded-[10px] border border-line bg-paper p-4 text-sm leading-6 text-inkMid">
                            Bạn cần đăng nhập để dùng số dư ví.
                            <Link href={`/login?next=${encodeURIComponent(`/campaigns/${campaignSlug}`)}`} className="button-primary mt-3 block text-center">Đăng nhập</Link>
                          </div>
                        ) : (
                          <div className="mt-5 space-y-4">
                            {walletError ? <p className="rounded-[8px] bg-son/10 px-3 py-2.5 text-sm text-son">{walletError}</p> : null}
                            <div className="rounded-[10px] bg-chamDeep p-4 text-white">
                              <p className="text-xs text-white/60">Số dư khả dụng</p>
                              <p className="mt-1 font-mono text-xl font-bold text-nghe">{walletBalance === null ? "Đang tải…" : `${currency.format(walletBalance)}đ`}</p>
                            </div>
                            <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                              Số tiền ủng hộ (VND)
                              <input
                                inputMode="numeric"
                                value={walletAmount}
                                onChange={(event) => setWalletAmount(event.target.value.replace(/[^0-9]/g, "").slice(0, 11))}
                                className="rounded-[8px] border border-line px-4 py-3 font-mono font-normal outline-none focus:border-son"
                              />
                              <span className="text-xs font-normal text-inkSoft">
                                {numericWalletAmount ? `${currency.format(numericWalletAmount)}đ` : `Tối thiểu ${currency.format(WALLET_MIN_TOPUP)}đ`}
                                {walletBalance !== null && numericWalletAmount > walletBalance ? " — vượt số dư khả dụng" : ""}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={handleWalletSubmit}
                              disabled={walletLoading || walletBalance === null || numericWalletAmount < WALLET_MIN_TOPUP || numericWalletAmount > walletBalance}
                              className="button-primary w-full disabled:cursor-wait disabled:opacity-50"
                            >
                              {walletLoading ? "Đang xử lý…" : "Xác nhận ủng hộ từ ví"}
                            </button>
                            <p className="text-center text-[11px] leading-5 text-inkSoft">Số tiền được trừ khỏi ví và ghi nhận ngay lập tức, không cần Admin đối soát.</p>
                            <Link href="/wallet" className="block text-center text-xs font-semibold text-sky hover:underline">Chưa đủ số dư? Nạp thêm vào ví →</Link>
                          </div>
                        )}
                      </div>
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
                        <p className="rounded-[10px] border border-sky/20 bg-skySoft p-3 text-xs leading-5 text-inkMid">Khoản ủng hộ được tiếp nhận qua tài khoản trung tâm của đơn vị thành viên VEA Group, sau đó đối soát và phân bổ cho đối tác thụ hưởng theo hồ sơ chiến dịch đã duyệt.</p>
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

                      <button
                        type="submit"
                        formAction={handleVnpaySubmit}
                        disabled={vnpayLoading || loading || numericAmount < DONATION_MIN_AMOUNT || numericAmount > DONATION_MAX_AMOUNT}
                        className="button-primary w-full disabled:cursor-wait disabled:opacity-50"
                      >
                        {vnpayLoading ? "Đang chuyển tới VNPAY…" : "Thanh toán qua VNPAY →"}
                      </button>
                      <p className="text-center text-[11px] leading-5 text-inkSoft">Hệ thống ghi nhận tự động ngay khi VNPAY xác nhận đã thanh toán (IPN đã ký số).</p>

                      <button
                        type="button"
                        onClick={() => setShowVietQrFallback((current) => !current)}
                        className="w-full text-center text-xs font-semibold text-sky hover:underline"
                      >
                        {showVietQrFallback ? "Ẩn phương án chuyển khoản thủ công" : "VNPAY gặp sự cố? Dùng VietQR/chuyển khoản thủ công"}
                      </button>

                      {showVietQrFallback ? (
                        <div className="rounded-[10px] border border-line bg-paper p-3">
                          <button
                            type="submit"
                            formAction={handleSubmit}
                            disabled={loading || vnpayLoading || numericAmount < DONATION_MIN_AMOUNT || numericAmount > DONATION_MAX_AMOUNT}
                            className="button-secondary w-full disabled:cursor-wait disabled:opacity-50"
                          >
                            {loading ? "Đang tạo giao dịch…" : "Tạo mã VietQR (Admin đối soát thủ công)"}
                          </button>
                          <p className="mt-2 text-center text-[11px] leading-5 text-inkSoft">Giao dịch chỉ chuyển từ chờ sang thành công sau khi Admin đối soát khớp sao kê ngân hàng.</p>
                        </div>
                      ) : null}
                    </form>
                  </>
                )}
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

      <div className="mt-5 flex flex-col items-center gap-2.5">
        <div className="rounded-[20px] border-2 border-son/15 bg-white p-4 shadow-card">
          <Image src={intent.qrUrl} width={268} height={268} alt={`VietQR ${intent.txRef}`} className="h-[268px] w-[268px] object-contain" />
        </div>
        <p className="text-center text-xs font-semibold text-inkSoft">📱 Quét bằng app ngân hàng bất kỳ hoặc ví hỗ trợ VietQR</p>
      </div>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        <PaymentRow
          label="Số tiền"
          value={`${currency.format(intent.amountVnd)}đ`}
          copy={() => onCopy("amount", String(intent.amountVnd))}
          copied={copied === "amount"}
          emphasize
        />
        <PaymentRow label="Ngân hàng" value={intent.bankId} mono={false} />
        <PaymentRow label="Số tài khoản" value={intent.accountNo} copy={() => onCopy("account", intent.accountNo)} copied={copied === "account"} />
        <PaymentRow label="Tên tài khoản" value={intent.accountName} mono={false} />
        <PaymentRow
          label="Nội dung chuyển khoản"
          value={intent.transferDescription}
          copy={() => onCopy("description", intent.transferDescription)}
          copied={copied === "description"}
          className="sm:col-span-2"
        />
      </div>

      <div className="mt-5 rounded-[10px] border border-nghe/25 bg-ngheXsoft px-4 py-3 text-sm leading-6 text-ngheDeep">
        Mã <strong className="font-mono">{intent.txRef}</strong> có hiệu lực đến {expiresAt}. Trạng thái hiện tại: <strong>Chờ ngân hàng xác nhận</strong>.
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {isAuthenticated ? <Link href="/account" className="button-primary flex-1 text-center">Xem lịch sử giao dịch</Link> : <button type="button" onClick={onClose} className="button-primary flex-1">Đóng</button>}
        <button type="button" onClick={onCreateAnother} className="flex-1 rounded-[40px] border border-lineStrong px-4 py-2.5 text-sm font-bold text-chamDeep hover:border-son hover:text-son">Tạo giao dịch khác</button>
      </div>
    </div>
  );
}

function PaymentRow({
  label,
  value,
  copy,
  copied = false,
  emphasize = false,
  mono = true,
  className = "",
}: {
  label: string;
  value: string;
  copy?: () => void;
  copied?: boolean;
  emphasize?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[10px] border px-4 py-3 ${
        emphasize ? "border-son/30 bg-sonSoft" : "border-line bg-white"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-inkSoft">{label}</div>
          <div
            className={`mt-1 break-all font-bold ${mono ? "font-mono" : ""} ${
              emphasize ? "text-xl text-son" : "text-base text-chamDeep"
            }`}
          >
            {value}
          </div>
        </div>
        {copy ? (
          <button
            type="button"
            onClick={copy}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              copied ? "bg-lua text-white" : "bg-paper text-sky hover:bg-sky/15"
            }`}
          >
            {copied ? (
              <>
                <span aria-hidden>✓</span> Đã chép
              </>
            ) : (
              <>
                <span aria-hidden>⧉</span> Sao chép
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
