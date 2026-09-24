"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createWalletTopup } from "@/app/wallet/actions";
import {
  WALLET_MAX_TOPUP,
  WALLET_MIN_TOPUP,
  type WalletLedgerItem,
  type WalletTopupIntent,
  type WalletTopupItem,
} from "@/lib/wallet/types";

const currency = new Intl.NumberFormat("vi-VN");
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });
const presets = [10_000, 50_000, 200_000, 500_000, 1_000_000, 2_000_000];
const statusLabel = { pending: "Chờ Admin đối soát", completed: "Đã cộng vào ví", rejected: "Không được xác nhận" } as const;
const statusClass = { pending: "bg-nghe/15 text-ngheDeep", completed: "bg-lua/15 text-lua", rejected: "bg-son/10 text-son" } as const;

export function WalletPanel({ balance, ledger, topups, loadError }: { balance: number; ledger: WalletLedgerItem[]; topups: WalletTopupItem[]; loadError: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("500000");
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<WalletTopupIntent | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const numericAmount = Number(amount || 0);
  const pendingTotal = topups.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amountVnd, 0);

  function submit(formData: FormData) {
    setError(null);
    formData.set("amountVnd", amount);
    startTransition(() => {
      void createWalletTopup(formData).then((result) => {
        if (!result.ok) return setError(result.message);
        setIntent(result.intent);
        router.refresh();
      }).catch(() => setError("Không thể tạo yêu cầu nạp ví. Vui lòng thử lại."));
    });
  }
  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  const intentRows = intent ? ([
    ["amount", "Số tiền", `${currency.format(intent.amountVnd)}đ`, String(intent.amountVnd)],
    ["bank", "Ngân hàng", intent.bankId, null],
    ["acc", "Số tài khoản", intent.accountNo, intent.accountNo],
    ["name", "Tên tài khoản", intent.accountName, null],
    ["desc", "Nội dung chuyển khoản", intent.transferDescription, intent.transferDescription],
  ] as const) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header>
        <p className="eyebrow">Tài khoản</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-chamDeep">Ví của tôi</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-inkMid">Nạp tiền vào ví bằng chuyển khoản tới tài khoản trung tâm. Số dư chỉ được cộng sau khi Admin đối soát khớp sao kê ngân hàng.</p>
      </header>
      {loadError ? <p className="rounded-[8px] border border-son/20 bg-son/5 p-3 text-sm text-son">{loadError}</p> : null}

      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <section className="self-start rounded-[14px] bg-chamDeep p-6 text-white shadow-card">
          <p className="text-xs text-white/60">Số dư khả dụng</p>
          <p className="mt-1 font-mono text-3xl font-bold text-nghe">{currency.format(balance)}đ</p>
          <p className="mt-4 text-xs leading-5 text-white/70">
            {pendingTotal > 0 ? `${currency.format(pendingTotal)}đ đang chờ Admin đối soát (chưa tính vào số dư). ` : ""}
            Tính năng dùng số dư để ủng hộ chiến dịch sẽ được bổ sung sau khi chốt cách vận hành.
          </p>
        </section>

        <section className="panel">
          {intent ? (
            <div>
              <h2 className="font-serif text-xl font-semibold text-chamDeep">Chuyển khoản để nạp ví</h2>
              <div className="mt-3 flex justify-center">
                <div className="rounded-[16px] border-2 border-son/15 bg-white p-3"><Image src={intent.qrUrl} width={220} height={220} alt={`VietQR ${intent.txRef}`} className="h-[220px] w-[220px] object-contain" unoptimized /></div>
              </div>
              <dl className="mt-4 divide-y divide-line text-sm">
                {intentRows.map(([key, label, value, copyValue]) => (
                  <div key={key} className="flex items-center justify-between gap-3 py-2">
                    <dt className="shrink-0 text-inkSoft">{label}</dt>
                    <dd className="flex items-center gap-2 break-all text-right font-semibold text-chamDeep">{value}
                      {copyValue ? <button type="button" onClick={() => copy(key, copyValue)} className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[11px] font-bold text-sky">{copied === key ? "✓ Đã chép" : "Chép"}</button> : null}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 rounded-[8px] bg-ngheXsoft p-3 text-xs leading-5 text-ngheDeep">Giữ nguyên số tiền và nội dung chuyển khoản. Mã <strong className="font-mono">{intent.txRef}</strong> đang chờ Admin đối soát; ví chưa được cộng tiền.</p>
              <button type="button" onClick={() => setIntent(null)} className="button-secondary mt-4 w-full">Tạo yêu cầu nạp khác</button>
            </div>
          ) : (
            <form action={submit} className="space-y-4">
              <h2 className="font-serif text-xl font-semibold text-chamDeep">Nạp tiền vào ví</h2>
              {error ? <p className="rounded-[8px] bg-son/10 px-3 py-2.5 text-sm text-son">{error}</p> : null}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {presets.map((value) => (
                  <button key={value} type="button" onClick={() => setAmount(String(value))} className={`rounded-[8px] border px-2 py-2.5 text-sm font-bold ${numericAmount === value ? "border-son bg-son/5 text-son" : "border-line text-chamDeep hover:border-son"}`}>{currency.format(value)}đ</button>
                ))}
              </div>
              <label className="grid gap-1 text-sm font-semibold text-chamDeep">Số tiền khác (VND)
                <input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, "").slice(0, 11))} required className="rounded-[8px] border border-line px-4 py-3 font-mono font-normal outline-none focus:border-son" />
                <span className="text-xs font-normal text-inkSoft">{numericAmount ? `${currency.format(numericAmount)}đ` : "Tối thiểu 10.000đ"}{numericAmount > 0 && numericAmount < WALLET_MIN_TOPUP ? " — chưa đạt mức tối thiểu 10.000đ" : ""}</span>
              </label>
              <button type="submit" disabled={pending || numericAmount < WALLET_MIN_TOPUP || numericAmount > WALLET_MAX_TOPUP} className="button-primary w-full disabled:opacity-50">{pending ? "Đang tạo…" : "Tạo mã VietQR nạp ví"}</button>
            </form>
          )}
        </section>
      </div>

      <section className="panel">
        <h2 className="font-serif text-xl font-semibold text-chamDeep">Yêu cầu nạp ví</h2>
        {topups.length === 0 ? <p className="mt-3 text-sm text-inkSoft">Bạn chưa có yêu cầu nạp nào.</p> : (
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="text-xs uppercase text-inkMid"><tr><th className="py-2 pr-3">Mã</th><th className="py-2 pr-3">Số tiền</th><th className="py-2 pr-3">Tạo lúc</th><th className="py-2">Trạng thái</th></tr></thead>
            <tbody>{topups.map((item) => <tr key={item.id} className="border-t border-line align-top">
              <td className="py-2.5 pr-3 font-mono text-xs text-chamDeep">{item.txRef}</td>
              <td className="py-2.5 pr-3 font-mono font-bold text-son">{currency.format(item.amountVnd)}đ</td>
              <td className="py-2.5 pr-3 text-xs text-inkSoft">{dateTime.format(new Date(item.createdAt))}</td>
              <td className="py-2.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass[item.status]}`}>{statusLabel[item.status]}</span>{item.status === "rejected" && item.adminNote ? <div className="mt-1 text-xs text-son">Lý do: {item.adminNote}</div> : null}</td>
            </tr>)}</tbody></table></div>
        )}
      </section>

      <section className="panel">
        <h2 className="font-serif text-xl font-semibold text-chamDeep">Lịch sử số dư</h2>
        {ledger.length === 0 ? <p className="mt-3 text-sm text-inkSoft">Chưa có biến động số dư.</p> : (
          <ul className="mt-3 divide-y divide-line text-sm">{ledger.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-2.5"><span><span className="font-semibold text-chamDeep">{item.note ?? "Biến động số dư"}</span><span className="block text-xs text-inkSoft">{dateTime.format(new Date(item.createdAt))}</span></span><span className={`font-mono font-bold ${item.amountVnd >= 0 ? "text-lua" : "text-son"}`}>{item.amountVnd >= 0 ? "+" : "−"}{currency.format(Math.abs(item.amountVnd))}đ</span></li>)}</ul>
        )}
      </section>
    </div>
  );
}
