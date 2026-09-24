"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { closeResourceNeed, createResourceNeed, deleteResourceNeed, updateResourceNeed, type ResourceActionResult } from "@/app/donate-items/actions";
import type { ManagedCampaign, ResourceNeed, ResourceType } from "@/components/donate-items/donate-items-portal";
import { PROVINCES } from "@/lib/geo/provinces";

type Props = { campaigns: ManagedCampaign[]; needs: ResourceNeed[] };
const typeLabels: Record<ResourceType, string> = { item: "Hiện vật", skill: "Ngày công / Kỹ năng", transport: "Vận chuyển" };
const field = "w-full rounded-[8px] border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-son";
const label = "grid gap-1.5 text-xs font-bold text-chamDeep";
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const reviewLabels: Record<string, string> = { pending_review: "Chờ Admin duyệt", approved: "Đã duyệt", rejected: "Đã từ chối" };
const availabilityLabels: Record<string, string> = { open: "Đang nhận", fulfilled: "Đã đủ", closed: "Đã đóng" };

export function ResourceCampaignManager({ campaigns, needs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ResourceActionResult | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function submitEdit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setNotice(null);
    startTransition(() => {
      void updateResourceNeed(id, data).then((result) => {
        setNotice(result);
        if (result.ok) { setEditingId(null); router.refresh(); }
      }).catch(() => setNotice({ ok: false, message: "Không thể cập nhật nhu cầu. Vui lòng thử lại." }));
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setNotice(null);
    startTransition(() => {
      void createResourceNeed(data).then((result) => {
        setNotice(result);
        if (result.ok) { form.reset(); router.refresh(); }
      }).catch(() => setNotice({ ok: false, message: "Không thể gửi đề xuất nhu cầu. Vui lòng thử lại." }));
    });
  }

  function run(action: (id: string) => Promise<ResourceActionResult>, id: string) {
    setNotice(null);
    startTransition(() => {
      void action(id).then((result) => {
        setNotice(result);
        if (result.ok) router.refresh();
      }).catch(() => setNotice({ ok: false, message: "Không thể cập nhật nhu cầu. Vui lòng thử lại." }));
    });
  }

  return <div id="resource-management" className="mt-8 scroll-mt-24 rounded-[14px] border-2 border-chamDeep/15 bg-paperMid p-6">
    <p className="eyebrow">Đề xuất nhu cầu nguồn lực</p>
    <h2 className="mt-1 font-serif text-2xl font-semibold text-chamDeep">Gửi nhu cầu để Admin xét duyệt</h2>
    <p className="mt-2 text-sm leading-6 text-inkMid">Nhu cầu sẽ ở trạng thái chờ duyệt và chưa xuất hiện trong wishlist công khai. Admin kiểm tra nội dung trước khi đăng.</p>
    {notice ? <p className={`mt-4 rounded-[8px] p-3 text-sm ${notice.ok ? "bg-lua/10 text-lua" : "bg-son/10 text-son"}`} role="status">{notice.message}</p> : null}

    {campaigns.length === 0 ? <div className="mt-5 rounded-[10px] border border-nghe/30 bg-nghe/10 p-4 text-sm text-ngheDeep">Cần có chiến dịch đã duyệt hoặc đang hoạt động để gửi đề xuất nguồn lực.</div> : <form className="mt-5 grid gap-3 rounded-[10px] bg-white p-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={submit}>
      <label className={label}>Chiến dịch<select className={field} name="campaignId" required>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select></label>
      <label className={label}>Loại nguồn lực<select className={field} name="resourceType">{(Object.keys(typeLabels) as ResourceType[]).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
      <label className={label}>Tên nhu cầu<input className={field} name="name" required minLength={2} maxLength={180} placeholder="Ví dụ: Vở học sinh" /></label>
      <label className={label}>Số lượng và đơn vị<div className="grid grid-cols-2 gap-2"><input className={field} name="quantityNeeded" type="number" min="0.01" step="0.01" required /><input className={field} name="unit" required maxLength={40} placeholder="cuốn / thùng / ngày công" /></div></label>
      <label className={label}>Khu vực<select className={field} name="province"><option value="">Theo chiến dịch</option>{PROVINCES.map((province) => <option key={province}>{province}</option>)}</select></label>
      <label className={label}>Mức độ<select className={field} name="urgency"><option value="normal">Bình thường</option><option value="urgent">Khẩn cấp</option></select></label>
      <label className={label}>Nhóm chi tiết<input className={field} name="category" maxLength={120} placeholder="Y tế, thực phẩm..." /></label>
      <label className={`${label} sm:col-span-2`}>Mô tả và lý do cần nhận<textarea className={field} name="description" rows={3} maxLength={2000} required /></label>
      <button disabled={pending} className="button-primary justify-self-start disabled:opacity-60 sm:col-span-2">{pending ? "Đang gửi…" : "Gửi Admin xét duyệt"}</button>
    </form>}

    <div className="mt-7">
      <h3 className="font-serif text-lg font-semibold text-chamDeep">Đề xuất nguồn lực của tổ chức ({needs.length})</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {needs.length === 0 ? <p className="rounded-[8px] bg-white p-4 text-sm text-inkSoft">Chưa gửi đề xuất nhu cầu nào.</p> : needs.map((need) => <article key={need.id} className="rounded-[8px] bg-white p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><strong className="text-chamDeep">{need.name}</strong><p className="mt-1 text-xs text-inkSoft">{need.campaign_title} · {number.format(need.quantity_needed)} {need.unit}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${need.moderation_status === "approved" ? "bg-lua/15 text-lua" : need.moderation_status === "rejected" ? "bg-son/10 text-son" : "bg-nghe/15 text-ngheDeep"}`}>{reviewLabels[need.moderation_status ?? "pending_review"] ?? "Chờ Admin duyệt"}</span></div>
          <p className="mt-2 text-xs text-inkMid">{need.description || "Không có mô tả."}</p>
          {need.review_note ? <p className="mt-2 rounded-[6px] bg-son/5 p-2 text-xs text-son">Ghi chú Admin: {need.review_note}</p> : null}
          {need.moderation_status === "approved" ? <div className="mt-2 flex items-center justify-between"><span className="text-xs text-inkSoft">{availabilityLabels[need.status] ?? need.status} · Đã xác minh nhận {number.format(need.claimed_quantity)} / {number.format(need.quantity_needed)} {need.unit}</span>{need.status === "open" ? <button type="button" disabled={pending} onClick={() => run(closeResourceNeed, need.id)} className="text-xs font-bold text-son disabled:opacity-50">Đóng nhu cầu</button> : null}</div> : <div className="mt-2 flex justify-end"><button type="button" disabled={pending} onClick={() => run(deleteResourceNeed, need.id)} className="text-xs font-bold text-son disabled:opacity-50">Xóa đề xuất</button></div>}
          {need.status === "open" && need.claimed_quantity + (need.committed_quantity ?? 0) === 0 ? (
            editingId === need.id ? (
              <form className="mt-3 grid gap-2.5 rounded-[8px] bg-paper p-3 sm:grid-cols-2" onSubmit={(event) => submitEdit(event, need.id)}>
                {need.moderation_status === "approved" ? <p className="rounded-[6px] bg-nghe/10 p-2 text-xs text-ngheDeep sm:col-span-2">Nhu cầu này đã được duyệt. Sau khi sửa, nhu cầu sẽ quay lại trạng thái chờ Admin duyệt lại và tạm ẩn khỏi wishlist công khai.</p> : null}
                <label className={`${label} sm:col-span-2`}>Tên nhu cầu<input className={field} name="name" required minLength={2} maxLength={180} defaultValue={need.name} /></label>
                <label className={label}>Số lượng<input className={field} name="quantityNeeded" type="number" min="0.01" step="0.01" required defaultValue={need.quantity_needed} /></label>
                <label className={label}>Đơn vị<input className={field} name="unit" required maxLength={40} defaultValue={need.unit} /></label>
                <label className={label}>Khu vực<select className={field} name="province" defaultValue={need.province ?? ""}><option value="">Theo chiến dịch</option>{PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}</select></label>
                <label className={label}>Mức độ<select className={field} name="urgency" defaultValue={need.urgency}><option value="normal">Bình thường</option><option value="urgent">Khẩn cấp</option></select></label>
                <label className={`${label} sm:col-span-2`}>Nhóm chi tiết<input className={field} name="category" maxLength={120} defaultValue={need.category ?? ""} /></label>
                <label className={`${label} sm:col-span-2`}>Mô tả và lý do cần nhận<textarea className={field} name="description" rows={3} maxLength={2000} required defaultValue={need.description} /></label>
                <div className="flex gap-2 sm:col-span-2">
                  <button disabled={pending} className="button-primary !px-4 !py-2 text-xs disabled:opacity-60">{pending ? "Đang lưu…" : "Lưu và gửi duyệt lại"}</button>
                  <button type="button" onClick={() => setEditingId(null)} className="button-secondary !px-4 !py-2 text-xs">Đóng</button>
                </div>
              </form>
            ) : <div className="mt-2 flex justify-end"><button type="button" disabled={pending} onClick={() => { setNotice(null); setEditingId(need.id); }} className="text-xs font-bold text-sky disabled:opacity-50">Sửa nhu cầu</button></div>
          ) : null}
        </article>)}
      </div>
    </div>
  </div>;
}
