"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import type { AppRole } from "@/lib/auth/roles";
import { PROVINCES } from "@/lib/geo/provinces";
import {
  cancelResourceClaim,
  cancelResourceOffer,
  createResourceOffer,
  claimResourceNeed,
  type ResourceActionResult,
} from "@/app/donate-items/actions";

export type ResourceType = "item" | "skill" | "transport";

export type ResourceNeed = {
  id: string;
  campaign_id: string;
  resource_type: ResourceType;
  name: string;
  description: string;
  category: string | null;
  quantity_needed: number;
  unit: string;
  province: string | null;
  urgency: "normal" | "urgent";
  status: string;
  created_at: string;
  campaign_title: string;
  campaign_slug: string;
  campaign_province: string | null;
  claimed_quantity: number;
};

export type ResourceOffer = {
  id: string;
  resource_type: ResourceType;
  title: string;
  description: string;
  quantity: number;
  unit: string;
  estimated_value_vnd: number | null;
  province: string | null;
  available_from: string | null;
  radius_km: number | null;
  status?: string;
  matched_need_id?: string | null;
  created_at: string;
};

export type ResourceClaim = {
  id: string;
  need_id: string;
  offer_id: string | null;
  quantity: number;
  status: string;
  expires_at: string | null;
  coordination_note: string | null;
  actual_value_vnd: number | null;
  created_at: string;
  need_name: string;
  need_unit: string;
  campaign_title: string;
  campaign_slug: string | null;
};

export type ManagedCampaign = { id: string; title: string; slug: string; status: string; province: string | null };

export type ManagedClaim = {
  id: string;
  need_id: string;
  offer_id: string | null;
  contributor_id: string;
  quantity: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  status: string;
  expires_at: string | null;
  coordination_note: string | null;
  actual_value_vnd: number | null;
  created_at: string;
  need_name: string;
  need_unit: string;
};

type Props = {
  isAuthenticated: boolean;
  role: AppRole | null;
  defaultName: string;
  defaultEmail: string;
  publicNeeds: ResourceNeed[];
  publicOffers: ResourceOffer[];
  ownOffers: ResourceOffer[];
  ownClaims: ResourceClaim[];
  managedCampaigns: ManagedCampaign[];
  loadError: string | null;
};

const typeLabels: Record<ResourceType, string> = { item: "Hiện vật", skill: "Ngày công / Kỹ năng", transport: "Vận chuyển" };
const typeIcons: Record<ResourceType, string> = { item: "📦", skill: "🤝", transport: "🚚" };
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

export function DonateItemsPortal(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | ResourceType>("all");
  const [provinceFilter, setProvinceFilter] = useState("");
  const [offerType, setOfferType] = useState<ResourceType>("item");
  const [transportLatitude, setTransportLatitude] = useState("");
  const [transportLongitude, setTransportLongitude] = useState("");
  const [transportGpsStatus, setTransportGpsStatus] = useState("");
  const [selectedNeed, setSelectedNeed] = useState<ResourceNeed | null>(null);

  const visibleNeeds = useMemo(() => props.publicNeeds.filter((item) =>
    (typeFilter === "all" || item.resource_type === typeFilter)
    && (!provinceFilter || item.province === provinceFilter || item.campaign_province === provinceFilter),
  ), [props.publicNeeds, provinceFilter, typeFilter]);

  const visibleOffers = useMemo(() => props.publicOffers.filter((item) =>
    (typeFilter === "all" || item.resource_type === typeFilter) && (!provinceFilter || item.province === provinceFilter),
  ), [props.publicOffers, provinceFilter, typeFilter]);

  function run(action: () => Promise<ResourceActionResult>, reset?: HTMLFormElement) {
    setNotice(null);
    startTransition(() => {
      void action().then((result) => {
        setNotice(result);
        if (result.ok) {
          reset?.reset();
          if (reset) {
            setTransportLatitude("");
            setTransportLongitude("");
            setTransportGpsStatus("");
          }
          setSelectedNeed(null);
          router.refresh();
        }
      }).catch(() => setNotice({ ok: false, message: "Không thể kết nối máy chủ. Vui lòng thử lại." }));
    });
  }

  function submit(event: FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<ResourceActionResult>, reset = false) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(() => action(data), reset ? form : undefined);
  }

  const compatibleOwnOffers = selectedNeed
    ? props.ownOffers.filter((offer) => offer.status === "available" && offer.resource_type === selectedNeed.resource_type)
    : [];

  return (
    <div>
      <section className="border-b border-line bg-paperMid">
        <div className="mx-auto max-w-[1160px] px-7 py-10">
          <p className="eyebrow">Nguồn lực cộng đồng</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="font-serif text-3xl font-semibold text-chamDeep sm:text-4xl">Không chỉ là tiền — Đóng góp đa hình thức</h1>
              <p className="mt-3 max-w-2xl leading-7 text-inkMid">Đăng ký hiện vật, kỹ năng hoặc phương tiện; ghép trực tiếp với wishlist của chiến dịch và theo dõi đến khi bàn giao.</p>
            </div>
            <a href="#register-resource" className="button-primary">+ Đăng ký nguồn lực</a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-7 py-9">
        {props.loadError ? <div className="mb-5 rounded-[8px] border border-son/30 bg-son/10 p-3 text-sm text-son">{props.loadError}</div> : null}
        {notice ? <div className={`sticky top-20 z-30 mb-5 rounded-[8px] border p-3 text-sm ${notice.ok ? "border-lua/30 bg-lua/10 text-lua" : "border-son/30 bg-son/10 text-son"}`}>{notice.message}</div> : null}

        <div id="register-resource" className="scroll-mt-24 rounded-[14px] border border-line bg-white p-6">
          <h2 className="font-serif text-xl font-semibold text-chamDeep">🎁 Tôi có nguồn lực muốn đóng góp</h2>
          <p className="mt-1 text-sm text-inkMid">Thông tin liên hệ chỉ hiển thị cho bạn, Admin và chủ chiến dịch sau khi ghép.</p>
          {!props.isAuthenticated ? (
            <div className="mt-4 rounded-[8px] bg-paperMid p-4 text-sm text-inkMid">Bạn cần <Link href="/login?next=%2Fdonate-items" className="font-bold text-son">đăng nhập</Link> để lưu nguồn lực và theo dõi bàn giao.</div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {(Object.keys(typeLabels) as ResourceType[]).map((type) => <button key={type} type="button" onClick={() => setOfferType(type)} className={`rounded-full border px-4 py-2 text-xs font-bold ${offerType === type ? "border-son bg-son text-white" : "border-lineStrong text-inkMid"}`}>{typeIcons[type]} {typeLabels[type]}</button>)}
              </div>
              <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => submit(event, createResourceOffer, true)}>
                <input type="hidden" name="resourceType" value={offerType} />
                <label className={label}>Tên nguồn lực<input className={field} name="title" required minLength={2} maxLength={180} placeholder={offerType === "item" ? "Ví dụ: Gạo ST25" : offerType === "skill" ? "Ví dụ: Sơ cấp cứu" : "Ví dụ: Xe tải 1,5 tấn"} /></label>
                <label className={label}>Số lượng và đơn vị<div className="grid grid-cols-2 gap-2"><input className={field} name="quantity" type="number" min="0.01" step="0.01" required /><input className={field} name="unit" required placeholder={offerType === "skill" ? "ngày công" : offerType === "transport" ? "chuyến" : "kg / thùng"} /></div></label>
                <label className={label}>Tỉnh / thành<select className={field} name="province"><option value="">Toàn quốc / chưa xác định</option>{PROVINCES.map((province) => <option key={province}>{province}</option>)}</select></label>
                <label className={label}>Có thể bắt đầu từ<input className={field} name="availableFrom" type="date" /></label>
                <label className={label}>Giá trị ước tính (VND, không cộng vào tiền quyên góp)<input className={field} name="estimatedValue" type="number" min="0" step="1000" /></label>
                <label className={label}>Bán kính phục vụ (km)<input className={field} name="radiusKm" type="number" min="1" max="2000" disabled={offerType === "item"} /></label>
                {offerType === "transport" ? (
                  <div className={`${label} sm:col-span-2`}>
                    Vị trí xe để ghép với SOS (tùy chọn; chỉ Admin thấy GPS chính xác)
                    <button type="button" className="button-secondary justify-self-start" onClick={() => {
                      if (!navigator.geolocation) { setTransportGpsStatus("Trình duyệt không hỗ trợ định vị."); return; }
                      setTransportGpsStatus("Đang lấy vị trí…");
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          setTransportLatitude(String(position.coords.latitude));
                          setTransportLongitude(String(position.coords.longitude));
                          setTransportGpsStatus("✓ Đã lưu vị trí xe để điều phối theo bán kính.");
                        },
                        () => setTransportGpsStatus("Không lấy được GPS. Hãy cấp quyền vị trí và thử lại."),
                      );
                    }}>📍 Lấy vị trí xe</button>
                    <input type="hidden" name="latitude" value={transportLatitude} />
                    <input type="hidden" name="longitude" value={transportLongitude} />
                    {transportGpsStatus ? <span className="text-xs text-inkSoft">{transportGpsStatus}</span> : null}
                  </div>
                ) : null}
                <label className={label}>Ưu tiên chiến dịch<select className={field} name="preferredCampaignId"><option value="">Để hệ thống ghép phù hợp</option>{props.managedCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select></label>
                <label className={label}>Người liên hệ<input className={field} name="contactName" defaultValue={props.defaultName} required /></label>
                <label className={label}>Email liên hệ<input className={field} name="contactEmail" type="email" defaultValue={props.defaultEmail} required /></label>
                <label className={label}>Số điện thoại<input className={field} name="contactPhone" /></label>
                <label className={`${label} sm:col-span-2`}>Mô tả chi tiết<textarea className={field} name="description" rows={3} maxLength={2000} placeholder="Tình trạng, quy cách, thời gian hoặc điều kiện bàn giao..." /></label>
                <button disabled={pending} className="button-primary justify-self-start sm:col-span-2">{pending ? "Đang lưu..." : "Lưu đăng ký nguồn lực"}</button>
              </form>
            </>
          )}
        </div>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
          <div><p className="eyebrow">Wishlist thật</p><h2 className="mt-1 font-serif text-2xl font-semibold text-chamDeep">Nhu cầu đang cần được đáp ứng</h2></div>
          <div className="flex flex-wrap gap-2">
            <select className={field} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | ResourceType)}><option value="all">Tất cả loại</option>{(Object.keys(typeLabels) as ResourceType[]).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select>
            <select className={field} value={provinceFilter} onChange={(event) => setProvinceFilter(event.target.value)}><option value="">Tất cả khu vực</option>{PROVINCES.map((province) => <option key={province}>{province}</option>)}</select>
          </div>
        </div>

        {visibleNeeds.length === 0 ? <div className="mt-5 rounded-[14px] border-2 border-dashed border-lineStrong p-10 text-center text-sm text-inkSoft">Chưa có nhu cầu phù hợp bộ lọc.</div> : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleNeeds.map((need) => {
              const claimed = Number(need.claimed_quantity);
              const remaining = Math.max(0, Number(need.quantity_needed) - claimed);
              const percent = Math.min(100, Math.round((claimed / Number(need.quantity_needed)) * 100));
              return <article key={need.id} className="overflow-hidden rounded-[14px] border border-line bg-white">
                <div className="h-1.5 bg-paperDeep"><div className="h-full bg-lua" style={{ width: `${percent}%` }} /></div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2"><span className="text-2xl">{typeIcons[need.resource_type]}</span>{need.urgency === "urgent" ? <span className="rounded-full bg-son/10 px-2 py-1 text-[10px] font-bold text-son">Khẩn cấp</span> : <Status value={need.status} />}</div>
                  <Link href={`/campaigns/${need.campaign_slug}`} className="mt-2 block text-xs font-bold text-lua hover:underline">{need.campaign_title}</Link>
                  <h3 className="mt-1 font-serif text-lg font-semibold text-chamDeep">{need.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-inkMid">{need.description || "Chưa có mô tả chi tiết."}</p>
                  <p className="mt-2 text-xs text-inkSoft">📍 {need.province || need.campaign_province || "Chưa xác định"}</p>
                  <p className="mt-3 text-sm"><strong>{number.format(claimed)} / {number.format(need.quantity_needed)} {need.unit}</strong> đã được giữ/nhận</p>
                  <button type="button" disabled={remaining <= 0 || need.status !== "open"} onClick={() => setSelectedNeed(need)} className="button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50">{remaining > 0 ? `Đóng góp (còn ${number.format(remaining)} ${need.unit})` : "Đã đủ nhu cầu"}</button>
                </div>
              </article>;
            })}
          </div>
        )}

        <div className="mt-12">
          <p className="eyebrow">Nguồn lực sẵn sàng</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-chamDeep">Cộng đồng đã đăng ký</h2>
          <p className="mt-2 text-sm text-inkMid">Danh sách công khai không hiển thị email hay số điện thoại. Chủ chiến dịch ghép nguồn lực từ khu vực quản lý bên dưới.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleOffers.length === 0 ? <p className="text-sm text-inkSoft">Chưa có nguồn lực sẵn sàng.</p> : visibleOffers.map((offer) => <article key={offer.id} className="rounded-[14px] border border-line bg-white p-4">
              <div className="flex items-center justify-between"><span className="text-2xl">{typeIcons[offer.resource_type]}</span><span className="text-[11px] font-bold text-lua">{typeLabels[offer.resource_type]}</span></div>
              <h3 className="mt-2 font-serif font-semibold text-chamDeep">{offer.title}</h3>
              <p className="mt-1 text-sm text-inkMid">{number.format(offer.quantity)} {offer.unit} · {offer.province || "Toàn quốc"}</p>
              {offer.radius_km ? <p className="mt-1 text-xs text-inkSoft">Bán kính {offer.radius_km} km</p> : null}
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-inkSoft">{offer.description || "Không có mô tả."}</p>
            </article>)}
          </div>
        </div>

        {props.isAuthenticated ? <AccountResources {...props} pending={pending} run={run} /> : null}

      </section>

      {selectedNeed ? <div className="fixed inset-0 z-50 grid place-items-center bg-chamDeep/55 p-4" role="dialog" aria-modal="true">
        <form onSubmit={(event) => submit(event, claimResourceNeed)} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[14px] bg-white p-6 shadow-xl">
          <input type="hidden" name="needId" value={selectedNeed.id} />
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-lua">{selectedNeed.campaign_title}</p><h2 className="mt-1 font-serif text-xl font-semibold text-chamDeep">Đăng ký: {selectedNeed.name}</h2></div><button type="button" onClick={() => setSelectedNeed(null)} className="text-xl text-inkSoft">×</button></div>
          {!props.isAuthenticated ? <p className="mt-5 rounded-[8px] bg-paperMid p-4 text-sm">Bạn cần <Link href="/login?next=%2Fdonate-items" className="font-bold text-son">đăng nhập</Link> để đăng ký.</p> : <div className="mt-5 grid gap-3">
            <label className={label}>Số lượng ({selectedNeed.unit})<input className={field} name="quantity" type="number" min="0.01" max={Math.max(0, selectedNeed.quantity_needed - selectedNeed.claimed_quantity)} step="0.01" required /></label>
            <label className={label}>Dùng nguồn lực đã đăng ký (không bắt buộc)<select className={field} name="offerId"><option value="">Đăng ký trực tiếp cho nhu cầu này</option>{compatibleOwnOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.title} — {number.format(offer.quantity)} {offer.unit}</option>)}</select></label>
            <label className={label}>Người liên hệ<input className={field} name="contactName" defaultValue={props.defaultName} required /></label>
            <label className={label}>Email<input className={field} name="contactEmail" type="email" defaultValue={props.defaultEmail} required /></label>
            <label className={label}>Số điện thoại<input className={field} name="contactPhone" /></label>
            <p className="rounded-[8px] bg-nghe/10 p-3 text-xs leading-5 text-ngheDeep">Đăng ký giữ chỗ trong 48 giờ. Nếu chưa được xác nhận, hệ thống sẽ trả số lượng về wishlist.</p>
            <button disabled={pending} className="button-primary">{pending ? "Đang xử lý..." : "Xác nhận đăng ký"}</button>
          </div>}
        </form>
      </div> : null}
    </div>
  );
}

function AccountResources(props: Props & { pending: boolean; run: (action: () => Promise<ResourceActionResult>) => void }) {
  return <div className="mt-12 rounded-[14px] border border-line bg-white p-6">
    <h2 className="font-serif text-xl font-semibold text-chamDeep">Nguồn lực và đăng ký của tôi</h2>
    <div className="mt-5 grid gap-6 lg:grid-cols-2">
      <div><h3 className="text-sm font-bold text-chamDeep">Nguồn lực đã đăng ({props.ownOffers.length})</h3><div className="mt-3 space-y-2">{props.ownOffers.length === 0 ? <p className="text-sm text-inkSoft">Chưa đăng nguồn lực nào.</p> : props.ownOffers.map((offer) => <div key={offer.id} className="rounded-[8px] bg-paper p-3 text-sm"><div className="flex justify-between gap-2"><strong>{offer.title}</strong><Status value={offer.status ?? "available"} /></div><p className="mt-1 text-xs text-inkSoft">{number.format(offer.quantity)} {offer.unit} · {typeLabels[offer.resource_type]}</p>{offer.status === "available" ? <button disabled={props.pending} type="button" onClick={() => props.run(() => cancelResourceOffer(offer.id))} className="mt-2 text-xs font-bold text-son">Hủy đăng ký</button> : null}</div>)}</div></div>
      <div><h3 className="text-sm font-bold text-chamDeep">Lượt đóng góp ({props.ownClaims.length})</h3><div className="mt-3 space-y-2">{props.ownClaims.length === 0 ? <p className="text-sm text-inkSoft">Chưa nhận wishlist nào.</p> : props.ownClaims.map((claim) => <div key={claim.id} className="rounded-[8px] bg-paper p-3 text-sm"><div className="flex justify-between gap-2"><div><strong>{claim.need_name}</strong><p className="mt-1 text-xs text-inkSoft">{claim.campaign_title} · {number.format(claim.quantity)} {claim.need_unit}</p></div><Status value={claim.status} /></div>{claim.expires_at && claim.status === "reserved" ? <p className="mt-1 text-xs text-ngheDeep">Giữ chỗ đến {formatDate(claim.expires_at)}</p> : null}{claim.coordination_note ? <p className="mt-2 text-xs text-inkMid">Điều phối: {claim.coordination_note}</p> : null}{["reserved", "confirmed"].includes(claim.status) ? <button disabled={props.pending} type="button" onClick={() => props.run(() => cancelResourceClaim(claim.id))} className="mt-2 text-xs font-bold text-son">Hủy lượt đóng góp</button> : null}</div>)}</div></div>
    </div>
  </div>;
}
