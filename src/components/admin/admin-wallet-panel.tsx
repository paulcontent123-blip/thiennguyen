"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmWalletTopup, rejectWalletTopup, reverseWalletAllocation, type WalletTopupReviewResult } from "@/app/admin/wallet-actions";

export type AdminWalletTopup = {
  id: string;
  user_id: string;
  tx_ref: string;
  amount_vnd: number | string;
  status: string;
  transfer_description: string;
  receiving_account_name: string;
  receiving_account_no: string;
  admin_note: string | null;
  created_at: string;
  completed_at: string | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

export type AdminWalletAllocation = {
  id: string;
  user_id: string;
  amount_vnd: number | string;
  status: string;
  reversal_reason: string | null;
  created_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
  campaigns: { title: string } | { title: string }[] | null;
  transactions: { tx_ref: string } | { tx_ref: string }[] | null;
};

const money = new Intl.NumberFormat("vi-VN");
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });
const statusLabel: Record<string, string> = { pending: "Chờ đối soát", completed: "Đã cộng ví", rejected: "Không xác nhận" };

function ownerName(item: AdminWalletTopup) {
  const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
  return profile?.full_name || `Người dùng ${item.user_id.slice(0, 8)}`;
}

export function AdminWalletPanel({ topups, allocations }: { topups: AdminWalletTopup[]; allocations: AdminWalletAllocation[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<WalletTopupReviewResult | null>(null);
  const waiting = topups.filter((item) => item.status === "pending");
  const processed = topups.filter((item) => item.status !== "pending").slice(0, 30);

  function run(action: () => Promise<WalletTopupReviewResult>) {
    setNotice(null);
    startTransition(() => {
      void action().then((result) => {
        setNotice(result);
        if (result.ok) router.refresh();
      }).catch(() => setNotice({ ok: false, message: "Không thể xử lý yêu cầu. Vui lòng thử lại." }));
    });
  }

  return <section className="space-y-6">
    <header>
      <h1 className="font-serif text-[21px] font-medium text-chamDeep">Đối soát nạp ví</h1>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-inkMid">Kiểm tra sao kê tài khoản nhận tiền, đối chiếu nội dung chuyển khoản (chứa mã VI-…) và số tiền rồi mới xác nhận. Xác nhận sẽ cộng số dư vào ví và không hoàn tác được.</p>
      {notice ? <p className={`mt-3 rounded-[8px] p-3 text-sm ${notice.ok ? "bg-lua/10 text-lua" : "bg-son/10 text-son"}`} role="status">{notice.message}</p> : null}
    </header>

    <div className="space-y-3">
      <h2 className="font-serif text-lg font-semibold text-chamDeep">Chờ đối soát ({waiting.length})</h2>
      {waiting.length === 0 ? <p className="rounded-[8px] border border-line bg-white px-4 py-8 text-center text-sm text-inkSoft">Không có yêu cầu nạp ví nào đang chờ.</p> : waiting.map((item) => <div key={item.id} className="rounded-[8px] border border-line bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="font-bold text-chamDeep">{ownerName(item)}</div><div className="mt-1 font-mono font-bold text-son">{money.format(Number(item.amount_vnd))}đ</div></div>
          <span className="rounded-full bg-nghe/15 px-2.5 py-1 text-[11px] font-bold text-ngheDeep">{statusLabel[item.status]}</span>
        </div>
        <div className="mt-3 grid gap-2 rounded-[6px] bg-paper p-3 text-xs sm:grid-cols-2">
          <div><span className="text-inkSoft">Mã: </span><strong className="font-mono text-chamDeep">{item.tx_ref}</strong></div>
          <div><span className="text-inkSoft">Nội dung CK: </span><strong className="font-mono text-chamDeep">{item.transfer_description}</strong></div>
          <div><span className="text-inkSoft">Tài khoản nhận: </span><strong className="text-chamDeep">{item.receiving_account_name} · {item.receiving_account_no}</strong></div>
          <div><span className="text-inkSoft">Tạo lúc: </span><strong className="text-chamDeep">{dateTime.format(new Date(item.created_at))}</strong></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button disabled={pending} type="button" onClick={() => {
            if (window.confirm(`Xác nhận đã nhận ${money.format(Number(item.amount_vnd))}đ (${item.tx_ref}) trên sao kê và cộng vào ví?`)) run(() => confirmWalletTopup(item.id));
          }} className="rounded-[4px] bg-lua px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">✅ Xác nhận đã nhận tiền</button>
          <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); run(() => rejectWalletTopup(item.id, data)); }} className="flex flex-wrap items-center gap-2">
            <input name="note" required minLength={3} placeholder="Lý do không xác nhận" className="w-52 rounded-[4px] border border-line px-2 py-1.5 text-xs outline-none focus:border-son" />
            <button disabled={pending} className="rounded-[4px] bg-son/10 px-3 py-1.5 text-xs font-bold text-son disabled:opacity-50">Không xác nhận</button>
          </form>
        </div>
      </div>)}
    </div>

    <div>
      <h2 className="font-serif text-lg font-semibold text-chamDeep">Đã xử lý gần đây</h2>
      <div className="mt-3 overflow-x-auto rounded-[8px] border border-line bg-white"><table className="w-full min-w-[640px] text-[13px]"><thead className="bg-paper text-left text-[11px] font-bold uppercase text-inkMid"><tr><th className="px-3 py-2.5">Mã</th><th className="px-3 py-2.5">Người nạp</th><th className="px-3 py-2.5">Số tiền</th><th className="px-3 py-2.5">Trạng thái</th></tr></thead><tbody>
        {processed.length === 0 ? <tr><td colSpan={4} className="px-3 py-8 text-center text-inkSoft">Chưa có yêu cầu nào được xử lý.</td></tr> : processed.map((item) => <tr key={item.id} className="border-t border-line"><td className="px-3 py-2.5 font-mono text-xs">{item.tx_ref}</td><td className="px-3 py-2.5">{ownerName(item)}</td><td className="px-3 py-2.5 font-mono font-bold text-son">{money.format(Number(item.amount_vnd))}đ</td><td className="px-3 py-2.5">{statusLabel[item.status] ?? item.status}{item.admin_note ? <div className="text-xs text-son">Lý do: {item.admin_note}</div> : null}</td></tr>)}
      </tbody></table></div>
    </div>

    <div>
      <h2 className="font-serif text-lg font-semibold text-chamDeep">Phân bổ ví vào chiến dịch</h2>
      <p className="mt-1 text-sm text-inkMid">Phân bổ hoàn tất được ghi đồng thời vào sổ cái và giao dịch. Chỉ hoàn tác khi giao dịch thực sự thất bại.</p>
      <div className="mt-3 space-y-2">{allocations.length === 0 ? <p className="rounded-[8px] border border-line bg-white px-4 py-6 text-center text-sm text-inkSoft">Chưa có phân bổ ví.</p> : allocations.slice(0, 50).map((item) => {
        const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        const campaign = Array.isArray(item.campaigns) ? item.campaigns[0] : item.campaigns;
        const transaction = Array.isArray(item.transactions) ? item.transactions[0] : item.transactions;
        return <article key={item.id} className="rounded-[8px] border border-line bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="text-chamDeep">{campaign?.title ?? "Chiến dịch"}</strong><div className="text-xs text-inkSoft">{profile?.full_name || item.user_id.slice(0, 8)} · {transaction?.tx_ref ?? "—"} · {dateTime.format(new Date(item.created_at))}</div></div><span className={`font-mono font-bold ${item.status === "completed" ? "text-son" : "text-lua"}`}>{money.format(Number(item.amount_vnd))}đ · {item.status === "completed" ? "Đã phân bổ" : "Đã hoàn tác"}</span></div>{item.reversal_reason ? <p className="mt-2 text-xs text-son">Lý do: {item.reversal_reason}</p> : null}{item.status === "completed" ? <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); if (window.confirm("Hoàn số tiền này về ví và đánh dấu giao dịch đã hoàn tiền?")) run(() => reverseWalletAllocation(item.id, data)); }} className="mt-2 flex flex-wrap gap-2"><input name="reason" minLength={3} required placeholder="Lý do hoàn tác" className="w-56 rounded-[4px] border border-line px-2 py-1.5 text-xs outline-none focus:border-son" /><button disabled={pending} className="rounded-[4px] bg-son/10 px-3 py-1.5 text-xs font-bold text-son disabled:opacity-50">Hoàn tác phân bổ</button></form> : null}</article>;
      })}</div>
    </div>
  </section>;
}
