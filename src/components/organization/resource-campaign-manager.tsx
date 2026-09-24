"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  closeResourceNeed,
  createResourceNeed,
  deleteResourceNeed,
  matchResourceOffer,
  updateResourceClaimStatus,
  type ResourceActionResult,
} from "@/app/donate-items/actions";
import type { ManagedCampaign, ManagedClaim, ResourceNeed, ResourceOffer, ResourceType } from "@/components/donate-items/donate-items-portal";
import { PROVINCES } from "@/lib/geo/provinces";

type Props = {
  campaigns: ManagedCampaign[];
  needs: ResourceNeed[];
  claims: ManagedClaim[];
  availableOffers: ResourceOffer[];
};

const typeLabels: Record<ResourceType, string> = { item: "Hiện vật", skill: "Ngày công / Kỹ năng", transport: "Vận chuyển" };
const statusLabels: Record<string, string> = {
  available: "Sẵn sàng", matched: "Đã ghép", delivered: "Đã bàn giao", cancelled: "Đã hủy",
  reserved: "Giữ chỗ", confirmed: "Đã xác nhận", expired: "Hết hạn", failed: "Không thành công",
  open: "Đang nhận", fulfilled: "Đã đủ", closed: "Đã đóng",
};
const field = "w-full rounded-[8px] border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-son";
const label = "grid gap-1.5 text-xs font-bold text-chamDeep";
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
}

function Status({ value }: { value: string }) {
  const tone = ["delivered", "fulfilled", "available"].includes(value)
    ? "bg-lua/15 text-lua"
    : ["cancelled", "failed", "expired", "closed"].includes(value)
      ? "bg-son/10 text-son"
      : "bg-nghe/15 text-ngheDeep";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>{statusLabels[value] ?? value}</span>;
}

export function ResourceCampaignManager({ campaigns, needs, claims, availableOffers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  function run(action: () => Promise<ResourceActionResult>, reset?: HTMLFormElement) {
    setNotice(null);
    startTransition(() => {
      void action().then((result) => {
        setNotice(result);
        if (result.ok) {
          reset?.reset();
          router.refresh();
        }
      }).catch(() => setNotice({ ok: false, message: "Không thể kết nối máy chủ. Vui lòng thử lại." }));
    });
  }

  function submit(event: FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<ResourceActionResult>, reset = false) {
    event.preventDefault();
    const form = event.currentTarget;
    run(() => action(new FormData(form)), reset ? form : undefined);
  }

  return (
    <div id="resource-management" className="mt-8 scroll-mt-24 rounded-[14px] border-2 border-chamDeep/15 bg-paperMid p-6">
      <p className="eyebrow">Điều phối dành cho chủ chiến dịch / Admin</p>
      <h2 className="mt-1 font-serif text-2xl font-semibold text-chamDeep">Quản lý wishlist và bàn giao</h2>
      <p className="mt-2 text-sm leading-6 text-inkMid">Tạo nhu cầu cho chiến dịch đã được duyệt, ghép nguồn lực cộng đồng và xác nhận kết quả bàn giao.</p>
      {notice ? <p className={`mt-4 rounded-[8px] p-3 text-sm ${notice.ok ? "bg-lua/10 text-lua" : "bg-son/10 text-son"}`}>{notice.message}</p> : null}

      {campaigns.length === 0 ? (
        <div className="mt-5 rounded-[10px] border border-nghe/30 bg-nghe/10 p-4 text-sm text-ngheDeep">Tổ chức cần có ít nhất một chiến dịch ở trạng thái Đã duyệt hoặc Đang hoạt động trước khi tạo wishlist.</div>
      ) : (
        <form className="mt-5 grid gap-3 rounded-[10px] bg-white p-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => submit(event, createResourceNeed, true)}>
          <label className={label}>Chiến dịch<select className={field} name="campaignId" required>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select></label>
          <label className={label}>Loại nguồn lực<select className={field} name="resourceType">{(Object.keys(typeLabels) as ResourceType[]).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
          <label className={label}>Tên nhu cầu<input className={field} name="name" required minLength={2} maxLength={180} /></label>
          <label className={label}>Số lượng và đơn vị<div className="grid grid-cols-2 gap-2"><input className={field} name="quantityNeeded" type="number" min="0.01" step="0.01" required /><input className={field} name="unit" required maxLength={40} /></div></label>
          <label className={label}>Khu vực<select className={field} name="province"><option value="">Theo chiến dịch</option>{PROVINCES.map((province) => <option key={province}>{province}</option>)}</select></label>
          <label className={label}>Mức độ<select className={field} name="urgency"><option value="normal">Bình thường</option><option value="urgent">Khẩn cấp</option></select></label>
          <label className={label}>Nhóm chi tiết<input className={field} name="category" placeholder="Y tế, thực phẩm..." /></label>
          <label className={`${label} sm:col-span-2`}>Mô tả<textarea className={field} name="description" rows={2} maxLength={2000} /></label>
          <button disabled={pending} className="button-primary justify-self-start disabled:opacity-60">{pending ? "Đang xử lý..." : "Thêm vào wishlist"}</button>
        </form>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-serif text-lg font-semibold text-chamDeep">Nhu cầu đã tạo ({needs.length})</h3>
          <div className="mt-3 space-y-2">
            {needs.length === 0 ? <p className="text-sm text-inkSoft">Chưa tạo nhu cầu nguồn lực nào.</p> : needs.map((need) => <div key={need.id} className="rounded-[8px] bg-white p-3 text-sm">
              <div className="flex justify-between gap-2"><div><strong>{need.name}</strong><p className="mt-1 text-xs text-inkSoft">{need.campaign_title} · {number.format(need.quantity_needed)} {need.unit}</p></div><Status value={need.status} /></div>
              {need.status !== "closed" ? <div className="mt-2 flex gap-3"><button type="button" disabled={pending} onClick={() => run(() => closeResourceNeed(need.id))} className="text-xs font-bold text-ngheDeep">Đóng nhu cầu</button><button type="button" disabled={pending} onClick={() => run(() => deleteResourceNeed(need.id))} className="text-xs font-bold text-son">Xóa nếu chưa có đăng ký</button></div> : null}
            </div>)}
          </div>
        </div>

        <div>
          <h3 className="font-serif text-lg font-semibold text-chamDeep">Ghép nguồn lực sẵn có</h3>
          <div className="mt-3 space-y-2">
            {availableOffers.length === 0 ? <p className="text-sm text-inkSoft">Chưa có nguồn lực cộng đồng để ghép.</p> : availableOffers.map((offer) => {
              const options = needs.filter((need) => need.resource_type === offer.resource_type && need.status === "open");
              return <form key={offer.id} onSubmit={(event) => submit(event, matchResourceOffer)} className="rounded-[8px] bg-white p-3 text-sm">
                <input type="hidden" name="offerId" value={offer.id} />
                <strong>{offer.title}</strong><p className="mt-1 text-xs text-inkSoft">{number.format(offer.quantity)} {offer.unit} · {offer.province || "Toàn quốc"}</p>
                {options.length > 0 ? <div className="mt-2 grid grid-cols-[1fr_90px_auto] gap-2"><select className={field} name="needId">{options.map((need) => <option key={need.id} value={need.id}>{need.name}</option>)}</select><input className={field} name="quantity" type="number" min="0.01" max={offer.quantity} step="0.01" required placeholder="SL" /><button disabled={pending} className="rounded-[8px] bg-chamDeep px-3 text-xs font-bold text-white disabled:opacity-60">Ghép</button></div> : <p className="mt-2 text-xs text-inkSoft">Không có nhu cầu cùng loại đang mở.</p>}
              </form>;
            })}
          </div>
        </div>
      </div>

      <div className="mt-7">
        <h3 className="font-serif text-lg font-semibold text-chamDeep">Điều phối đăng ký ({claims.length})</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {claims.length === 0 ? <p className="text-sm text-inkSoft">Chưa có người nhận wishlist.</p> : claims.map((claim) => <form key={claim.id} onSubmit={(event) => submit(event, (data) => updateResourceClaimStatus(claim.id, data))} className="rounded-[8px] bg-white p-4 text-sm">
            <div className="flex justify-between gap-2"><div><strong>{claim.need_name}</strong><p className="mt-1 text-xs text-inkSoft">{claim.contact_name} · {claim.contact_email}{claim.contact_phone ? ` · ${claim.contact_phone}` : ""}</p><p className="mt-1 text-xs text-inkSoft">{number.format(claim.quantity)} {claim.need_unit} · tạo {formatDate(claim.created_at)}</p></div><Status value={claim.status} /></div>
            {["reserved", "confirmed"].includes(claim.status) ? <div className="mt-3 grid gap-2"><select className={field} name="status" defaultValue={claim.status === "reserved" ? "confirmed" : "delivered"}>{claim.status === "reserved" ? <option value="confirmed">Xác nhận điều phối</option> : null}{claim.status === "confirmed" ? <option value="delivered">Xác nhận đã bàn giao</option> : null}<option value="failed">Đánh dấu không thành công</option><option value="cancelled">Hủy bởi điều phối</option></select><input className={field} name="actualValue" type="number" min="0" step="1000" placeholder="Giá trị thực tế VND (nếu đã bàn giao)" /><textarea className={field} name="coordinationNote" defaultValue={claim.coordination_note ?? ""} maxLength={1000} placeholder="Ghi chú lịch, địa điểm hoặc biên bản bàn giao" /><button disabled={pending} className="button-primary justify-self-start disabled:opacity-60">Cập nhật</button></div> : claim.coordination_note ? <p className="mt-2 text-xs text-inkMid">{claim.coordination_note}</p> : null}
          </form>)}
        </div>
      </div>
    </div>
  );
}
