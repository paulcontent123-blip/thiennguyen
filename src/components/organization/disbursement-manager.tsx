"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveDisbursementAsRepresentative,
  createDisbursement,
  submitDisbursement,
  submitDisbursementExplanation,
  type DisbursementActionResult,
} from "@/app/organization/disbursement-actions";

export type ManagedDisbursement = {
  id: string;
  amount: number | string;
  description: string;
  status: string;
  evidence_paths: string[];
  submitted_at: string | null;
  representative_approved_at: string | null;
  post_audit_status: string;
  post_audit_note: string | null;
  explanation: string | null;
  published_at: string | null;
  created_at: string;
};

const money = new Intl.NumberFormat("vi-VN");
const statusLabel: Record<string, string> = { draft: "Bản nháp", submitted: "Chờ đại diện xác nhận", representative_approved: "Chờ Admin hậu kiểm", recorded: "Đã ghi nhận", published: "Đã công khai" };
const auditLabel: Record<string, string> = { not_reviewed: "Chưa hậu kiểm", valid: "Hợp lệ", needs_explanation: "Cần giải trình", violation: "Vi phạm" };

export function DisbursementManager({ campaignId, representativeName, disbursements }: { campaignId: string; representativeName: string; disbursements: ManagedDisbursement[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<DisbursementActionResult | null>(null);
  function run(action: () => Promise<DisbursementActionResult>) {
    setNotice(null);
    startTransition(() => void action().then((result) => {
      setNotice(result);
      if (result.ok) router.refresh();
    }).catch(() => setNotice({ ok: false, message: "Không thể xử lý hồ sơ. Vui lòng thử lại." })));
  }

  return <section className="rounded-[12px] border border-line bg-white p-6">
    <div>
      <p className="eyebrow">Giải ngân</p>
      <h2 className="mt-1 font-serif text-xl font-semibold text-chamDeep">Lập hồ sơ khoản chi</h2>
      <p className="mt-1 text-sm leading-6 text-inkMid">Chứng từ được khóa sau khi gửi. Khoản chi chỉ xuất hiện công khai sau khi người đại diện xác nhận và Admin hậu kiểm hợp lệ.</p>
    </div>
    {notice ? <p className={`mt-4 rounded-[8px] p-3 text-sm ${notice.ok ? "bg-lua/10 text-lua" : "bg-son/10 text-son"}`}>{notice.message}</p> : null}
    <form action={(formData) => run(() => createDisbursement(campaignId, formData))} className="mt-5 grid gap-3 rounded-[10px] bg-paper p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-chamDeep">Số tiền (VND)<input name="amount" inputMode="numeric" required className="rounded-[8px] border border-line px-3 py-2.5 font-mono font-normal outline-none focus:border-son" /></label>
        <label className="grid gap-1 text-sm font-semibold text-chamDeep">Hóa đơn/chứng từ<input name="evidence" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple required className="rounded-[8px] border border-line bg-white px-3 py-2 text-xs font-normal" /></label>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-chamDeep">Nội dung khoản chi<textarea name="description" minLength={10} maxLength={2000} rows={3} required className="rounded-[8px] border border-line px-3 py-2.5 font-normal outline-none focus:border-son" /></label>
      <div className="flex items-center justify-between gap-3"><span className="text-xs text-inkSoft">PDF/JPG/PNG/WebP · tổng tối đa 10 MB · 8 tệp</span><button disabled={pending} className="button-primary !py-2.5 text-sm disabled:opacity-50">{pending ? "Đang lưu…" : "Tạo bản nháp"}</button></div>
    </form>

    <div className="mt-5 space-y-3">
      {disbursements.length === 0 ? <p className="text-sm text-inkSoft">Chưa có hồ sơ giải ngân.</p> : disbursements.map((item) => <article key={item.id} className="rounded-[10px] border border-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="font-mono text-son">{money.format(Number(item.amount))}đ</strong><p className="mt-1 text-sm text-inkMid">{item.description}</p></div><div className="text-right text-xs"><div className="font-bold text-sky">{statusLabel[item.status] ?? item.status}</div><div className="mt-1 text-inkSoft">{auditLabel[item.post_audit_status] ?? item.post_audit_status}</div></div></div>
        <div className="mt-3 flex flex-wrap gap-2">{item.evidence_paths.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-full bg-sky/10 px-2.5 py-1 text-xs font-bold text-sky">Chứng từ {index + 1}</a>)}</div>
        {item.post_audit_note ? <p className="mt-3 rounded-[6px] bg-son/10 px-3 py-2 text-xs text-son"><strong>Ghi chú Admin:</strong> {item.post_audit_note}</p> : null}
        {item.status === "draft" ? <button type="button" disabled={pending} onClick={() => run(() => submitDisbursement(campaignId, item.id))} className="mt-3 rounded-[7px] bg-sky px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Gửi xác nhận</button> : null}
        {item.status === "submitted" ? <form action={(formData) => run(() => approveDisbursementAsRepresentative(campaignId, item.id, formData))} className="mt-3 grid gap-2 rounded-[8px] bg-ngheXsoft p-3"><p className="text-xs leading-5 text-ngheDeep">Người đại diện pháp luật <strong>{representativeName}</strong> xác nhận hồ sơ và chịu trách nhiệm về chứng từ đã cung cấp.</p><input name="representativeName" placeholder="Nhập đúng họ tên người đại diện" required className="rounded-[7px] border border-line bg-white px-3 py-2 text-sm outline-none focus:border-son" /><label className="flex items-start gap-2 text-xs text-inkMid"><input type="checkbox" name="confirmed" value="yes" required className="mt-0.5" />Tôi xác nhận đây là approval của người đại diện pháp luật.</label><button disabled={pending} className="w-fit rounded-[7px] bg-son px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Ký xác nhận và gửi hậu kiểm</button></form> : null}
        {item.post_audit_status === "needs_explanation" ? <form action={(formData) => run(() => submitDisbursementExplanation(campaignId, item.id, formData))} className="mt-3 grid gap-2"><textarea name="explanation" minLength={3} required rows={3} placeholder="Nội dung giải trình và thông tin bổ sung" className="rounded-[7px] border border-line px-3 py-2 text-sm outline-none focus:border-son" /><button disabled={pending} className="w-fit rounded-[7px] bg-sky px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Gửi lại giải trình</button></form> : null}
        {item.published_at ? <p className="mt-3 text-xs font-bold text-lua">✓ Khoản chi đã được công khai trong Cashflow Tree.</p> : null}
      </article>)}
    </div>
  </section>;
}
