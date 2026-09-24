"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  cancelResourceClaim,
  cancelResourceOffer,
  hideResourceClaim,
  hideResourceOffer,
  updateResourceOffer,
  type ResourceActionResult,
} from "@/app/donate-items/actions";
import type { ResourceClaim, ResourceOffer, ResourceType } from "@/components/donate-items/donate-items-portal";
import { PROVINCES } from "@/lib/geo/provinces";

const typeLabels: Record<ResourceType, string> = { item: "Hiện vật", skill: "Ngày công / Kỹ năng", transport: "Vận chuyển" };
const statusLabels: Record<string, string> = {
  available: "Sẵn sàng", matched: "Đã ghép", delivered: "Đã bàn giao", cancelled: "Đã hủy",
  reserved: "Chờ Admin xác minh ghép", confirmed: "Đã xác minh ghép", expired: "Hết hạn", failed: "Không thành công",
};
const field = "w-full rounded-[8px] border border-line bg-white px-3 py-2 text-sm outline-none focus:border-son";
const label = "grid gap-1 text-xs font-bold text-chamDeep";
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function StatusPill({ value }: { value: string }) {
  const tone = ["delivered", "available"].includes(value)
    ? "bg-lua/15 text-lua"
    : ["cancelled", "failed", "expired"].includes(value) ? "bg-son/10 text-son" : "bg-nghe/15 text-ngheDeep";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>{statusLabels[value] ?? value}</span>;
}

export function OwnResources({ offers, claims }: { offers: ResourceOffer[]; claims: ResourceClaim[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ResourceActionResult | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function run(action: () => Promise<ResourceActionResult>, closeEditor = false) {
    setNotice(null);
    startTransition(() => {
      void action().then((result) => {
        setNotice(result);
        if (result.ok) {
          if (closeEditor) setEditingId(null);
          router.refresh();
        }
      }).catch(() => setNotice({ ok: false, message: "Không thể kết nối máy chủ. Vui lòng thử lại." }));
    });
  }

  function submitEdit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run(() => updateResourceOffer(id, data), true);
  }

  function confirmAndRun(message: string, action: () => Promise<ResourceActionResult>) {
    if (window.confirm(message)) run(action);
  }

  return <div className="mt-12 rounded-[14px] border border-line bg-white p-6">
    <h2 className="font-serif text-xl font-semibold text-chamDeep">Nguồn lực và đăng ký của tôi</h2>
    <p className="mt-1 text-xs leading-5 text-inkSoft">Nguồn lực còn ở trạng thái Sẵn sàng có thể sửa hoặc hủy. Đã ghép hoặc đã bàn giao thì do Admin xác minh nên không sửa trực tiếp. Mục đã hủy có thể ẩn khỏi danh sách của bạn (lịch sử vẫn được lưu).</p>
    {notice ? <p role="status" className={`mt-4 rounded-[8px] p-3 text-sm ${notice.ok ? "bg-lua/10 text-lua" : "bg-son/10 text-son"}`}>{notice.message}</p> : null}

    <div className="mt-5 grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="text-sm font-bold text-chamDeep">Nguồn lực đã đăng ({offers.length})</h3>
        <div className="mt-3 space-y-2">
          {offers.length === 0 ? <p className="text-sm text-inkSoft">Chưa đăng nguồn lực nào.</p> : offers.map((offer) => (
            <div key={offer.id} className="rounded-[8px] bg-paper p-3 text-sm">
              <div className="flex justify-between gap-2"><strong>{offer.title}</strong><StatusPill value={offer.status ?? "available"} /></div>
              <p className="mt-1 text-xs text-inkSoft">{number.format(offer.quantity)} {offer.unit} · {typeLabels[offer.resource_type]}</p>
              {editingId === offer.id ? (
                <form className="mt-3 grid gap-2.5 rounded-[8px] bg-white p-3 sm:grid-cols-2" onSubmit={(event) => submitEdit(event, offer.id)}>
                  <label className={`${label} sm:col-span-2`}>Tên nguồn lực<input className={field} name="title" required minLength={2} maxLength={180} defaultValue={offer.title} /></label>
                  <label className={label}>Số lượng<input className={field} name="quantity" type="number" min="0.01" step="0.01" required defaultValue={offer.quantity} /></label>
                  <label className={label}>Đơn vị<input className={field} name="unit" required maxLength={40} defaultValue={offer.unit} /></label>
                  <label className={label}>Giá trị quy đổi (VND)<input className={field} name="estimatedValue" type="number" min="0" step="1000" defaultValue={offer.estimated_value_vnd ?? ""} /></label>
                  <label className={label}>Khu vực<select className={field} name="province" defaultValue={offer.province ?? ""}><option value="">Không giới hạn</option>{PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}</select></label>
                  <label className={label}>Có thể từ ngày<input className={field} name="availableFrom" type="date" defaultValue={offer.available_from ?? ""} /></label>
                  <label className={label}>Bán kính phục vụ (km)<input className={field} name="radiusKm" type="number" min="1" max="2000" defaultValue={offer.radius_km ?? ""} /></label>
                  <label className={label}>Tên liên hệ<input className={field} name="contactName" required minLength={2} maxLength={120} defaultValue={offer.contact_name ?? ""} /></label>
                  <label className={label}>Email liên hệ<input className={field} name="contactEmail" type="email" required defaultValue={offer.contact_email ?? ""} /></label>
                  <label className={label}>Số điện thoại<input className={field} name="contactPhone" maxLength={30} defaultValue={offer.contact_phone ?? ""} /></label>
                  <label className={`${label} sm:col-span-2`}>Mô tả<textarea className={field} name="description" rows={3} maxLength={2000} defaultValue={offer.description} /></label>
                  <div className="flex gap-2 sm:col-span-2">
                    <button disabled={pending} className="button-primary !px-4 !py-2 text-xs disabled:opacity-60">{pending ? "Đang lưu…" : "Lưu thay đổi"}</button>
                    <button type="button" onClick={() => setEditingId(null)} className="button-secondary !px-4 !py-2 text-xs">Đóng</button>
                  </div>
                </form>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-3">
                {offer.status === "available" && editingId !== offer.id ? <button disabled={pending} type="button" onClick={() => { setNotice(null); setEditingId(offer.id); }} className="text-xs font-bold text-sky disabled:opacity-50">Sửa</button> : null}
                {offer.status === "available" ? <button disabled={pending} type="button" onClick={() => confirmAndRun("Hủy đăng ký nguồn lực này?", () => cancelResourceOffer(offer.id))} className="text-xs font-bold text-son disabled:opacity-50">Hủy đăng ký</button> : null}
                {offer.status === "cancelled" ? <button disabled={pending} type="button" onClick={() => run(() => hideResourceOffer(offer.id))} className="text-xs font-bold text-inkMid disabled:opacity-50">Ẩn khỏi danh sách</button> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-chamDeep">Lượt đóng góp ({claims.length})</h3>
        <div className="mt-3 space-y-2">
          {claims.length === 0 ? <p className="text-sm text-inkSoft">Chưa nhận wishlist nào.</p> : claims.map((claim) => (
            <div key={claim.id} className="rounded-[8px] bg-paper p-3 text-sm">
              <div className="flex justify-between gap-2">
                <div><strong>{claim.need_name}</strong><p className="mt-1 text-xs text-inkSoft">{claim.campaign_title} · {number.format(claim.quantity)} {claim.need_unit}</p></div>
                <StatusPill value={claim.status} />
              </div>
              {claim.coordination_note ? <p className="mt-2 text-xs text-inkMid">Điều phối: {claim.coordination_note}</p> : null}
              <div className="mt-2 flex flex-wrap gap-3">
                {["reserved", "confirmed"].includes(claim.status) ? <button disabled={pending} type="button" onClick={() => confirmAndRun("Hủy lượt đóng góp này?", () => cancelResourceClaim(claim.id))} className="text-xs font-bold text-son disabled:opacity-50">Hủy lượt đóng góp</button> : null}
                {claim.status === "cancelled" && !claim.confirmed_at ? <button disabled={pending} type="button" onClick={() => run(() => hideResourceClaim(claim.id))} className="text-xs font-bold text-inkMid disabled:opacity-50">Ẩn khỏi danh sách</button> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>;
}
