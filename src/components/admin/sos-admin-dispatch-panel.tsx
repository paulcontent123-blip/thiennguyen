"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  alertNearestVolunteer,
  closeSosReport,
  coordinateSosTransport,
  createSosEmergencyCampaign,
  rejectSosCampaignRequest,
  setSosAutoClose,
  updateSosCoordinates,
  updateSosTransportDispatch,
  type SosDispatchResult,
} from "@/app/admin/sos/actions";

type Report = {
  id: string;
  location_text: string;
  description: string | null;
  needs: string[];
  status: string;
  latitude: number | null;
  longitude: number | null;
  contact_phone: string | null;
  auto_close_on_team_complete: boolean;
  created_at: string;
};
type Request = { id: string; title: string; target_amount: number | string; contact_email: string | null; status: string; review_note: string | null };
type Offer = { offer_id: string; title: string; province: string | null; distance_km: number; contact_name: string; contact_email: string; contact_phone: string | null; radius_km: number };
type Dispatch = {
  id: string; offer_id: string; status: string; created_at: string;
  resource_offers: { title: string; contact_name: string; contact_email: string; contact_phone: string | null }
    | { title: string; contact_name: string; contact_email: string; contact_phone: string | null }[] | null;
};
type Alert = { id: string; rescue_team_id: string; distance_km: number; source: string; acknowledged_at: string | null; response_status: string | null; response_note: string | null; responded_at: string | null; rescue_teams: { name: string; member_kind: string } | { name: string; member_kind: string }[] | null };

const progressLabels: Record<string, { label: string; className: string }> = {
  en_route: { label: "Đang tới", className: "bg-sky/15 text-sky" },
  on_scene: { label: "Đã đến hiện trường", className: "bg-nghe/15 text-ngheDeep" },
  completed: { label: "Đã xử lý xong", className: "bg-lua/15 text-lua" },
  cannot_assist: { label: "Không hỗ trợ được", className: "bg-son/15 text-son" },
};

export function SosAdminDispatchPanel({ report, request, linkedCampaignId, organizations, offers, dispatches, alerts }: {
  report: Report;
  request: Request | null;
  linkedCampaignId: string | null;
  organizations: { id: string; name: string }[];
  offers: Offer[];
  dispatches: Dispatch[];
  alerts: Alert[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<SosDispatchResult | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const active = report.status === "urgent" || report.status === "needs_support";
  const teamCompleted = alerts.filter((alert) => alert.response_status === "completed");
  const dispatchByOffer = new Map(dispatches.map((dispatch) => [dispatch.offer_id, dispatch]));

  function run(action: () => Promise<SosDispatchResult>) {
    setNotice(null);
    startTransition(() => {
      void action().then((result) => {
        setNotice(result);
        if (result.ok) router.refresh();
      }).catch(() => setNotice({ ok: false, message: "Không thể kết nối máy chủ. Vui lòng thử lại." }));
    });
  }

  return (
    <div>
      <h1 className="mt-4 font-serif text-3xl font-semibold text-chamDeep">Điều phối: {report.location_text}</h1>
      <p className="mt-2 text-sm text-inkMid">Trạng thái: <strong>{report.status}</strong> · Nhu cầu: {report.needs.join(" · ") || "Chưa rõ"}</p>
      {report.description ? <p className="mt-2 text-sm text-inkMid">{report.description}</p> : null}
      <div className="mt-2 text-xs text-inkSoft">
        GPS: {report.latitude !== null && report.longitude !== null ? `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}` : "Chưa có"}
        {report.contact_phone ? <> · Liên hệ: <a href={`tel:${report.contact_phone}`} className="font-semibold text-sky">{report.contact_phone}</a></> : null}
      </div>
      {!active ? <p className="mt-5 rounded-[8px] bg-nghe/10 p-3 text-sm text-ngheDeep">Chỉ SOS đang cần hỗ trợ mới được phát cảnh báo, ghép xe hoặc tạo chiến dịch. Báo cáo của khách phải được xác nhận ở <Link href="/admin" className="underline">Admin Portal</Link> trước.</p> : null}
      {report.latitude === null || report.longitude === null ? <p className="mt-3 rounded-[8px] bg-nghe/10 p-3 text-sm text-ngheDeep">Báo cáo chưa có GPS; không thể ghép theo bán kính. Admin cần xác minh và bổ sung vị trí trước khi điều phối theo khoảng cách.</p> : null}
      {notice ? <p role="status" className={`mt-4 rounded-[8px] p-3 text-sm ${notice.ok ? "bg-lua/10 text-lua" : "bg-son/10 text-son"}`}>{notice.message} {notice.ok && notice.campaignId ? <Link href={`/campaign-management/${notice.campaignId}`} className="ml-2 font-bold underline">Mở bản nháp →</Link> : null}</p> : null}

      {active && teamCompleted.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-lua/40 bg-lua/10 p-4">
          <div className="text-sm text-lua"><strong>Đội báo đã xử lý xong</strong> ({teamCompleted.length} đội). Kiểm tra ghi chú bên dưới rồi xác nhận để đóng SOS.</div>
          <button type="button" disabled={pending} onClick={() => run(() => closeSosReport(report.id))} className="button-primary text-xs">Xác nhận đóng SOS</button>
        </div>
      ) : null}
      {active ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-white p-4">
          <label className="flex items-center gap-2 text-sm text-chamDeep">
            <input type="checkbox" checked={report.auto_close_on_team_complete} disabled={pending} onChange={(event) => run(() => setSosAutoClose(report.id, event.target.checked))} className="h-4 w-4" />
            Tự đóng SOS khi đội báo &ldquo;Đã xử lý xong&rdquo;
          </label>
          <button type="button" disabled={pending} onClick={() => run(() => closeSosReport(report.id))} className="button-secondary text-xs">Đóng SOS thủ công</button>
        </div>
      ) : null}

      <form className="mt-5 flex flex-wrap items-end gap-3 rounded-[10px] border border-line bg-white p-4" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => updateSosCoordinates(report.id, data));
      }}>
        <label className="grid gap-1 text-xs font-semibold">Vĩ độ đã xác minh
          <input name="latitude" required type="number" step="any" min={-90} max={90} defaultValue={report.latitude ?? undefined} className="w-40 rounded-[8px] border border-line p-2 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-semibold">Kinh độ đã xác minh
          <input name="longitude" required type="number" step="any" min={-180} max={180} defaultValue={report.longitude ?? undefined} className="w-40 rounded-[8px] border border-line p-2 text-sm" />
        </label>
        <button disabled={pending} type="submit" className="button-secondary text-xs">Cập nhật vị trí SOS</button>
      </form>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <section className="rounded-[14px] border border-line bg-white p-5">
          <h2 className="font-serif text-xl font-semibold text-chamDeep">Cảnh báo đội cứu trợ / TNV</h2>
          <p className="mt-1 text-xs leading-5 text-inkSoft">Đội sẵn sàng trong bán kính được cảnh báo tự động sau khi SOS được xác minh. Nút dưới ưu tiên TNV cá nhân gần nhất đã được Admin duyệt.</p>
          <button type="button" disabled={pending || !active || report.latitude === null || report.longitude === null} onClick={() => run(() => alertNearestVolunteer(report.id))} className="button-primary mt-4 text-sm disabled:opacity-50">Báo TNV gần nhất</button>
          <div className="mt-4 space-y-2">
            {alerts.length ? alerts.map((alert) => {
              const team = Array.isArray(alert.rescue_teams) ? alert.rescue_teams[0] : alert.rescue_teams;
              return <div key={alert.id} className="rounded-[8px] bg-paper p-3 text-sm"><strong>{team?.name ?? "Đội cứu trợ"}</strong> · {Number(alert.distance_km).toFixed(1)} km<span className="block text-xs text-inkSoft">{team?.member_kind === "volunteer" ? "TNV cá nhân" : "Đội cứu trợ"} · {alert.acknowledged_at ? "Đã xem" : "Chưa xác nhận"} · {alert.source === "admin" ? "Admin báo" : "Tự động"}</span>{alert.response_status ? <span className={`mt-1.5 inline-block rounded-[4px] px-2 py-0.5 text-xs font-bold ${progressLabels[alert.response_status]?.className ?? "bg-inkSoft/15 text-inkSoft"}`}>{progressLabels[alert.response_status]?.label ?? alert.response_status}</span> : null}{alert.response_note ? <span className="mt-1 block text-xs text-inkMid">“{alert.response_note}”</span> : null}{alert.responded_at ? <span className="block text-[11px] text-inkSoft">Cập nhật {new Date(alert.responded_at).toLocaleString("vi-VN")}</span> : null}</div>;
            }) : <p className="text-sm text-inkSoft">Chưa có đội trong bán kính hoặc chưa có GPS.</p>}
          </div>
        </section>

        <section className="rounded-[14px] border border-line bg-white p-5">
          <h2 className="font-serif text-xl font-semibold text-chamDeep">Xe vận chuyển gần SOS</h2>
          <p className="mt-1 text-xs leading-5 text-inkSoft">Chỉ nguồn lực xe còn sẵn sàng, có GPS và nằm trong bán kính người đăng khai báo. Thông tin liên hệ chỉ dành cho Admin.</p>
          <div className="mt-4 space-y-3">
            {offers.length ? offers.map((offer) => {
              const dispatch = dispatchByOffer.get(offer.offer_id);
              return <div key={offer.offer_id} className="rounded-[8px] border border-line p-3 text-sm">
                <strong>{offer.title}</strong> · {Number(offer.distance_km).toFixed(1)} km
                <p className="mt-1 text-xs text-inkSoft">{offer.contact_name} · {offer.province || "Chưa rõ tỉnh"} · bán kính {offer.radius_km} km</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs"><a className="font-bold text-sky hover:underline" href={`mailto:${offer.contact_email}`}>{offer.contact_email}</a>{offer.contact_phone ? <a className="font-bold text-sky hover:underline" href={`tel:${offer.contact_phone}`}>{offer.contact_phone}</a> : null}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!dispatch ? <button disabled={pending} type="button" onClick={() => run(() => coordinateSosTransport(report.id, offer.offer_id))} className="button-secondary text-xs">Ghi nhận đã liên hệ</button> : <span className="text-xs font-bold text-lua">Trạng thái: {dispatch.status}</span>}
                  {dispatch && dispatch.status === "contacted" ? <><button disabled={pending} type="button" onClick={() => run(() => updateSosTransportDispatch(dispatch.id, "accepted", report.id))} className="text-xs font-bold text-lua">Đã nhận</button><button disabled={pending} type="button" onClick={() => run(() => updateSosTransportDispatch(dispatch.id, "declined", report.id))} className="text-xs font-bold text-son">Từ chối</button></> : null}
                  {dispatch?.status === "accepted" ? <button disabled={pending} type="button" onClick={() => run(() => updateSosTransportDispatch(dispatch.id, "completed", report.id))} className="text-xs font-bold text-lua">Đã bàn giao</button> : null}
                </div>
              </div>;
            }) : <p className="text-sm text-inkSoft">Không có xe phù hợp có GPS trong bán kính đã khai báo.</p>}
          </div>
          {dispatches.length ? <div className="mt-5 border-t border-line pt-4"><h3 className="text-sm font-bold text-chamDeep">Lịch sử điều phối xe</h3><div className="mt-2 space-y-1.5">{dispatches.map((dispatch) => {
            const offer = Array.isArray(dispatch.resource_offers) ? dispatch.resource_offers[0] : dispatch.resource_offers;
            return <p key={dispatch.id} className="text-xs text-inkMid">{offer?.title ?? "Xe"} · {dispatch.status} · {new Date(dispatch.created_at).toLocaleString("vi-VN")}</p>;
          })}</div></div> : null}
        </section>
      </div>

      <section className="mt-5 rounded-[14px] border border-line bg-white p-5">
        <h2 className="font-serif text-xl font-semibold text-chamDeep">Chiến dịch khẩn cấp từ SOS</h2>
        {request ? <p className="mt-2 text-sm text-inkMid">Đề xuất: <strong>{request.title}</strong> · {Number(request.target_amount).toLocaleString("vi-VN")}đ · {request.status}{request.contact_email ? ` · ${request.contact_email}` : ""}</p> : <p className="mt-2 text-sm text-inkSoft">Người báo không đề xuất gây quỹ. Admin vẫn có thể tạo bản nháp sau khi xác minh SOS.</p>}
        {request?.review_note ? <p className="mt-1 text-xs text-son">Lý do: {request.review_note}</p> : null}
        {linkedCampaignId ? <Link href={`/campaign-management/${linkedCampaignId}`} className="button-secondary mt-4 inline-flex">Mở chiến dịch đã tạo →</Link> : (
          <>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              run(() => createSosEmergencyCampaign(report.id, data));
            }}>
              <label className="grid gap-1 text-sm font-semibold">Tổ chức chịu trách nhiệm
                <select name="organizationId" required className="rounded-[8px] border border-line p-2 text-sm"><option value="">Chọn tổ chức đã duyệt</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select>
              </label>
              <label className="grid gap-1 text-sm font-semibold">Mục tiêu (VND)
                <input name="targetAmount" type="number" min={100000} max={100000000000} step={1} required defaultValue={request ? Number(request.target_amount) : undefined} className="rounded-[8px] border border-line p-2 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Tên chiến dịch
                <input name="title" required minLength={8} maxLength={180} defaultValue={request?.title ?? `Cứu trợ khẩn cấp tại ${report.location_text}`} className="rounded-[8px] border border-line p-2 text-sm" />
              </label>
              <button disabled={pending || !active || organizations.length === 0} type="submit" className="button-primary justify-self-start text-sm disabled:opacity-50">Tạo bản nháp cho tổ chức</button>
            </form>
            {request?.status === "pending_review" ? <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4"><input value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} placeholder="Lý do từ chối đề xuất" className="min-w-64 flex-1 rounded-[8px] border border-line p-2 text-sm" /><button type="button" disabled={pending || rejectNote.trim().length < 5} onClick={() => run(() => rejectSosCampaignRequest(report.id, rejectNote))} className="rounded-[8px] bg-son/10 px-4 py-2 text-sm font-bold text-son disabled:opacity-50">Từ chối đề xuất</button></div> : null}
          </>
        )}
      </section>
    </div>
  );
}
