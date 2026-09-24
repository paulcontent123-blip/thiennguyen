"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  matchResourceOfferAsAdmin,
  reviewResourceClaim,
  reviewResourceNeed,
  type ResourceAdminResult,
} from "@/app/admin/resources/actions";
import { suggestNeedsForOffer } from "@/lib/resources/match-suggestions";

export type AdminResourceNeed = {
  id: string; campaign_id: string; resource_type: "item" | "skill" | "transport";
  name: string; description: string; quantity_needed: number; unit: string; province: string | null;
  urgency: string; status: string; moderation_status: string; review_note: string | null; created_at: string;
  campaign_title: string; campaign_slug: string; campaign_province: string | null;
};
export type AdminResourceOffer = {
  id: string; user_id: string; resource_type: "item" | "skill" | "transport"; title: string;
  description: string; quantity: number; unit: string; province: string | null; available_from: string | null;
  contact_name: string; contact_email: string; contact_phone: string | null; preferred_campaign_id: string | null; created_at: string;
};
export type AdminResourceClaim = {
  id: string; need_id: string; contributor_id: string; quantity: number; delivered_quantity: number | null;
  contact_name: string; contact_email: string; contact_phone: string | null; status: string;
  coordination_note: string | null; actual_value_vnd: number | null; created_at: string;
  need_name: string; need_unit: string; campaign_title: string; campaign_slug: string;
};

const typeLabel = { item: "Hiện vật", skill: "Kỹ năng / ngày công", transport: "Phương tiện" };
const typeIcon = { item: "📦", skill: "🤝", transport: "🚚" };
const fmt = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });
const field = "w-full rounded-[8px] border border-line bg-white px-3 py-2 text-sm outline-none focus:border-son";

function date(value: string) { return dateFmt.format(new Date(value)); }
function Status({ value }: { value: string }) {
  const label: Record<string, string> = {
    pending_review: "Chờ Admin duyệt", approved: "Đã duyệt", rejected: "Từ chối",
    open: "Đang nhận", fulfilled: "Đã đủ", closed: "Đã đóng", reserved: "Chờ xác minh ghép",
    confirmed: "Đã xác minh ghép", delivered: "Đã xác minh bàn giao", failed: "Không thành công",
    available: "Chờ ghép", matched: "Đã ghép", cancelled: "Đã hủy",
  };
  const good = ["approved", "fulfilled", "delivered", "matched"].includes(value);
  const bad = ["rejected", "failed", "closed", "cancelled"].includes(value);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${good ? "bg-lua/15 text-lua" : bad ? "bg-son/10 text-son" : "bg-nghe/15 text-ngheDeep"}`}>{label[value] ?? value}</span>;
}

export function AdminResourceWorkflow({ needs, offers, claims, loadError }: { needs: AdminResourceNeed[]; offers: AdminResourceOffer[]; claims: AdminResourceClaim[]; loadError: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ResourceAdminResult | null>(null);
  const waitingNeeds = needs.filter((need) => need.moderation_status === "pending_review");
  const matchableNeeds = needs.filter((need) => need.moderation_status === "approved" && need.status === "open");
  const matchableClaims = claims.filter((claim) => claim.status === "reserved");
  const deliveryClaims = claims.filter((claim) => claim.status === "confirmed");
  const received = needs.reduce((total, need) => total + claims
    .filter((claim) => claim.need_id === need.id && claim.status === "delivered")
    .reduce((sum, claim) => sum + Number(claim.delivered_quantity ?? claim.quantity), 0), 0);

  const remainingByNeed = new Map(needs.map((need) => [need.id, need.quantity_needed - claims
    .filter((claim) => claim.need_id === need.id && ["reserved", "confirmed", "delivered"].includes(claim.status))
    .reduce((sum, claim) => sum + Number(claim.status === "delivered" ? claim.delivered_quantity ?? claim.quantity : claim.quantity), 0)]));

  function run(action: () => Promise<ResourceAdminResult>) {
    setNotice(null);
    startTransition(() => {
      void action().then((result) => {
        setNotice(result);
        if (result.ok) router.refresh();
      }).catch(() => setNotice({ ok: false, message: "Không thể xử lý yêu cầu. Vui lòng thử lại." }));
    });
  }
  function submit(event: FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<ResourceAdminResult>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run(() => action(data));
  }

  return <section className="space-y-8">
    <header>
      <p className="eyebrow">Điều phối nguồn lực</p>
      <h1 className="mt-1 font-serif text-2xl font-semibold text-chamDeep">Duyệt nhu cầu, xác minh ghép và bàn giao</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-inkMid">Wishlist chỉ công khai sau khi Admin duyệt. Tiến độ chỉ tính số lượng thực nhận đã được Admin xác minh.</p>
      {notice ? <p className={`mt-4 rounded-[8px] p-3 text-sm ${notice.ok ? "bg-lua/10 text-lua" : "bg-son/10 text-son"}`} role="status">{notice.message}</p> : null}
      {loadError ? <p className="mt-4 rounded-[8px] border border-son/20 bg-son/5 p-3 text-sm text-son">{loadError}</p> : null}
    </header>

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-[10px] border border-line bg-white p-4"><strong className="text-2xl text-chamDeep">{waitingNeeds.length}</strong><p className="text-xs text-inkSoft">Nhu cầu chờ duyệt</p></div>
      <div className="rounded-[10px] border border-line bg-white p-4"><strong className="text-2xl text-chamDeep">{matchableClaims.length}</strong><p className="text-xs text-inkSoft">Đăng ký chờ xác minh ghép</p></div>
      <div className="rounded-[10px] border border-line bg-white p-4"><strong className="text-2xl text-chamDeep">{deliveryClaims.length}</strong><p className="text-xs text-inkSoft">Đang chờ xác minh bàn giao</p></div>
    </div>

    <section>
      <h2 className="font-serif text-xl font-semibold text-chamDeep">Nhu cầu chờ duyệt ({waitingNeeds.length})</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {waitingNeeds.length === 0 ? <p className="rounded-[8px] bg-white p-5 text-sm text-inkSoft">Không có nhu cầu chờ duyệt.</p> : waitingNeeds.map((need) => <article key={need.id} className="rounded-[10px] border border-line bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-lua">{need.campaign_title}</p><h3 className="mt-1 font-serif text-lg font-semibold text-chamDeep">{typeIcon[need.resource_type]} {need.name}</h3></div><Status value={need.moderation_status} /></div>
          <p className="mt-2 text-sm text-inkMid">{fmt.format(need.quantity_needed)} {need.unit} · {need.province || need.campaign_province || "Chưa xác định khu vực"} · {need.urgency === "urgent" ? "Khẩn cấp" : "Bình thường"}</p>
          {need.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-inkMid">{need.description}</p> : null}
          <p className="mt-2 text-xs text-inkSoft">Gửi {date(need.created_at)} · <a className="text-sky hover:underline" href={`/campaigns/${need.campaign_slug}`} target="_blank" rel="noreferrer">Xem campaign</a></p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={pending} type="button" onClick={() => run(() => reviewResourceNeed(need.id, "approved", new FormData()))} className="rounded-[7px] bg-lua px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Duyệt và công khai</button>
            <form onSubmit={(event) => submit(event, (data) => reviewResourceNeed(need.id, "rejected", data))} className="flex min-w-0 flex-1 gap-2">
              <input className={field} name="note" required minLength={5} placeholder="Lý do từ chối" />
              <button disabled={pending} className="shrink-0 rounded-[7px] bg-son/10 px-3 py-2 text-xs font-bold text-son disabled:opacity-50">Từ chối</button>
            </form>
          </div>
        </article>)}
      </div>
    </section>

    <section>
      <h2 className="font-serif text-xl font-semibold text-chamDeep">Đăng ký chờ xác minh ghép ({matchableClaims.length})</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {matchableClaims.length === 0 ? <p className="rounded-[8px] bg-white p-5 text-sm text-inkSoft">Không có đăng ký chờ xác minh ghép.</p> : matchableClaims.map((claim) => <article key={claim.id} className="rounded-[10px] border border-line bg-white p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-lua">{claim.campaign_title}</p><h3 className="mt-1 font-serif text-lg font-semibold text-chamDeep">{claim.need_name}</h3></div><Status value={claim.status} /></div>
          <p className="mt-2 text-sm text-inkMid">Đăng ký {fmt.format(claim.quantity)} {claim.need_unit} · {date(claim.created_at)}</p>
          <p className="mt-2 text-xs text-inkSoft">{claim.contact_name} · {claim.contact_email}{claim.contact_phone ? ` · ${claim.contact_phone}` : ""}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={pending} type="button" onClick={() => run(() => reviewResourceClaim(claim.id, "confirm_match", new FormData()))} className="rounded-[7px] bg-lua px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Xác minh ghép</button>
            <form onSubmit={(event) => submit(event, (data) => reviewResourceClaim(claim.id, "reject_match", data))} className="flex min-w-0 flex-1 gap-2">
              <input className={field} name="note" required minLength={3} placeholder="Lý do từ chối ghép" />
              <button disabled={pending} className="shrink-0 rounded-[7px] bg-son/10 px-3 py-2 text-xs font-bold text-son disabled:opacity-50">Từ chối</button>
            </form>
          </div>
        </article>)}
      </div>
    </section>

    <section>
      <h2 className="font-serif text-xl font-semibold text-chamDeep">Chờ xác minh bàn giao ({deliveryClaims.length})</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {deliveryClaims.length === 0 ? <p className="rounded-[8px] bg-white p-5 text-sm text-inkSoft">Không có lượt ghép nào chờ bàn giao.</p> : deliveryClaims.map((claim) => <form key={claim.id} onSubmit={(event) => submit(event, (data) => reviewResourceClaim(claim.id, "delivered", data))} className="rounded-[10px] border border-line bg-white p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-lua">{claim.campaign_title}</p><h3 className="mt-1 font-serif text-lg font-semibold text-chamDeep">{claim.need_name}</h3></div><Status value={claim.status} /></div>
          <p className="mt-2 text-sm text-inkMid">Đăng ký tối đa {fmt.format(claim.quantity)} {claim.need_unit} · {claim.contact_name} · {claim.contact_email}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold text-chamDeep">Số lượng thực nhận<input className={field} name="deliveredQuantity" type="number" min="0.01" max={claim.quantity} step="0.01" required /></label>
            <label className="grid gap-1 text-xs font-bold text-chamDeep">Giá trị thực tế VND (tùy chọn)<input className={field} name="actualValueVnd" type="number" min="0" step="1000" /></label>
            <label className="grid gap-1 text-xs font-bold text-chamDeep sm:col-span-2">Ghi chú xác minh / biên bản<input className={field} name="note" required minLength={3} placeholder="Ví dụ: Đã đối chiếu biên nhận tại điểm tiếp nhận…" /></label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2"><button disabled={pending} className="rounded-[7px] bg-lua px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Xác nhận bàn giao</button>
            <button disabled={pending} type="button" onClick={() => {
              const data = new FormData(); data.set("note", "Admin xác minh lượt bàn giao không thành công.");
              run(() => reviewResourceClaim(claim.id, "failed", data));
            }} className="rounded-[7px] bg-son/10 px-3 py-2 text-xs font-bold text-son disabled:opacity-50">Không thành công</button></div>
        </form>)}
      </div>
    </section>

    <section>
      <h2 className="font-serif text-xl font-semibold text-chamDeep">Nguồn lực chưa được ghép ({offers.length})</h2>
      <p className="mt-1 text-sm text-inkMid">Admin chọn nhu cầu phù hợp và xác minh thông tin trước khi tạo lượt ghép.</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {offers.length === 0 ? <p className="rounded-[8px] bg-white p-5 text-sm text-inkSoft">Không có nguồn lực chờ ghép.</p> : offers.map((offer) => {
          const compatible = suggestNeedsForOffer(offer, matchableNeeds, remainingByNeed);
          return <form key={offer.id} onSubmit={(event) => submit(event, matchResourceOfferAsAdmin)} className="rounded-[10px] border border-line bg-white p-4">
            <input type="hidden" name="offerId" value={offer.id} />
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-serif text-lg font-semibold text-chamDeep">{typeIcon[offer.resource_type]} {offer.title}</h3><p className="mt-1 text-sm text-inkMid">{fmt.format(offer.quantity)} {offer.unit} · {offer.province || "Chưa rõ khu vực"}</p></div><Status value="available" /></div>
            {offer.description ? <p className="mt-2 text-sm text-inkMid">{offer.description}</p> : null}
            <p className="mt-2 text-xs text-inkSoft">{offer.contact_name} · {offer.contact_email}{offer.contact_phone ? ` · ${offer.contact_phone}` : ""}</p>
            {compatible.length ? <OfferMatchPicker suggestions={compatible} offerQuantity={offer.quantity} pending={pending} /> : <p className="mt-3 text-xs text-inkSoft">Chưa có nhu cầu đã duyệt, còn thiếu, cùng loại nguồn lực.</p>}
          </form>;
        })}
      </div>
    </section>

    <section>
      <h2 className="font-serif text-xl font-semibold text-chamDeep">Tiến độ đã xác minh</h2>
      <div className="mt-3 overflow-x-auto rounded-[10px] border border-line bg-white"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-paper text-xs uppercase text-inkMid"><tr><th className="px-4 py-3">Nhu cầu / campaign</th><th className="px-4 py-3">Đã xác minh</th><th className="px-4 py-3">Mục tiêu</th><th className="px-4 py-3">Trạng thái</th></tr></thead><tbody>{needs.filter((need) => need.moderation_status === "approved").map((need) => {
        const quantity = claims.filter((claim) => claim.need_id === need.id && claim.status === "delivered").reduce((sum, claim) => sum + Number(claim.delivered_quantity ?? claim.quantity), 0);
        return <tr key={need.id} className="border-t border-line"><td className="px-4 py-3"><strong>{need.name}</strong><div className="text-xs text-inkSoft">{need.campaign_title}</div></td><td className="px-4 py-3 font-bold text-lua">{fmt.format(quantity)} {need.unit}</td><td className="px-4 py-3">{fmt.format(need.quantity_needed)} {need.unit}</td><td className="px-4 py-3"><Status value={need.status} /></td></tr>;
      })}</tbody></table></div>
      <span className="sr-only">Tổng số lượng đã xác minh: {fmt.format(received)}</span>
    </section>
  </section>;
}

function OfferMatchPicker({ suggestions, offerQuantity, pending }: { suggestions: ReturnType<typeof suggestNeedsForOffer<AdminResourceNeed>>; offerQuantity: number; pending: boolean }) {
  const [needId, setNeedId] = useState(suggestions[0].need.id);
  const selected = suggestions.find((item) => item.need.id === needId) ?? suggestions[0];
  return <div className="mt-3">
    <div className="grid grid-cols-[minmax(0,1fr)_100px_auto] gap-2">
      <select className={field} name="needId" value={selected.need.id} onChange={(event) => setNeedId(event.target.value)}>
        {suggestions.map((item, index) => <option key={item.need.id} value={item.need.id}>{index === 0 ? "Đề xuất · " : ""}{item.need.campaign_title}: {item.need.name} ({item.score} điểm)</option>)}
      </select>
      <input key={selected.need.id} className={field} name="quantity" type="number" min="0.01" max={Math.min(offerQuantity, selected.remaining)} step="0.01" required defaultValue={selected.suggestedQuantity} />
      <button disabled={pending} className="rounded-[7px] bg-chamDeep px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Xác minh ghép</button>
    </div>
    <p className="mt-2 text-xs text-inkSoft">Còn thiếu {fmt.format(selected.remaining)} {selected.need.unit}. Lý do gợi ý: {selected.reasons.join(" · ")}. Chỉ là gợi ý, Admin vẫn xác minh thủ công.</p>
  </div>;
}
