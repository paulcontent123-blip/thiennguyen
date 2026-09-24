"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitSosReport } from "@/app/sos/actions";
import { SOS_NEEDS } from "@/lib/sos/needs";

export function SosReportForm({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [requestCampaign, setRequestCampaign] = useState(false);

  function getLocation() {
    if (!navigator.geolocation) {
      setGpsStatus("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    setGpsStatus("Đang lấy vị trí…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setGpsStatus(`✓ Đã lấy vị trí (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`);
      },
      () => setGpsStatus("Không lấy được vị trí — có thể tự mô tả vị trí bằng chữ."),
    );
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await submitSosReport(formData);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSuccess(result.message);
    router.refresh();
  }

  if (success) {
    return (
      <div className="rounded-[14px] border border-lua/30 bg-lua/10 p-6 text-center text-sm text-lua">
        {success}
        <button type="button" onClick={() => setSuccess(null)} className="button-secondary mt-4 inline-flex">
          Gửi báo cáo khác
        </button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-[14px] border border-line bg-white p-6">
      <h2 className="font-serif text-lg font-semibold text-chamDeep">🚨 Phát tín hiệu SOS</h2>

      {error ? <p className="rounded-[8px] bg-son/10 p-3 text-sm text-son">{error}</p> : null}

      {!isAuthenticated ? (
        <p className="rounded-[8px] bg-nghe/10 p-3 text-xs leading-5 text-ngheDeep">
          Bạn đang gửi với tư cách khách. Báo cáo sẽ được Admin xác nhận trước khi hiển thị công khai và chuyển tới đội cứu trợ.
        </p>
      ) : null}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />

      <label className="grid gap-1 text-sm font-semibold text-chamDeep">
        Vị trí (mô tả cụ thể: xã/huyện/tỉnh, địa danh gần nhất)
        <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="locationText" placeholder="VD: Xã Đồng Văn, Hà Giang" required />
      </label>

      <div>
        <button type="button" onClick={getLocation} className="button-secondary">
          📍 Lấy vị trí GPS (tuỳ chọn)
        </button>
        {gpsStatus ? <p className="mt-1.5 text-xs text-inkSoft">{gpsStatus}</p> : null}
        <input type="hidden" name="latitude" value={latitude} />
        <input type="hidden" name="longitude" value={longitude} />
      </div>

      <label className="grid gap-1 text-sm font-semibold text-chamDeep">
        📷 Ảnh hiện trường (bắt buộc)
        <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
      </label>

      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-semibold text-chamDeep">Nhu cầu khẩn cấp</legend>
        <div className="flex flex-wrap gap-3">
          {SOS_NEEDS.map((need) => (
            <label key={need} className="flex items-center gap-1.5 text-sm text-inkMid">
              <input type="checkbox" name="needs" value={need} className="h-4 w-4" />
              {need}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-1 text-sm font-semibold text-chamDeep">
        Mô tả tình trạng
        <textarea className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="description" rows={3} placeholder="Mô tả chi tiết tình trạng, số người bị ảnh hưởng…" />
      </label>

      <label className="grid gap-1 text-sm font-semibold text-chamDeep">
        Số điện thoại liên hệ
        <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="contactPhone" type="tel" placeholder="09xx xxx xxx" required />
      </label>

      <div className="rounded-[8px] border border-line bg-paper p-4">
        <label className="flex items-start gap-2 text-sm font-semibold text-chamDeep">
          <input type="checkbox" name="requestCampaign" checked={requestCampaign} onChange={(event) => setRequestCampaign(event.target.checked)} className="mt-1" />
          Đề xuất lập chiến dịch gây quỹ khẩn cấp từ SOS này
        </label>
        <p className="mt-1 text-xs leading-5 text-inkSoft">Người chưa đăng nhập cũng có thể đề xuất. Admin xác minh SOS và chọn tổ chức đã duyệt; đề xuất không tự mở nhận tiền.</p>
        {requestCampaign ? (
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-xs font-semibold text-chamDeep">Tên chiến dịch đề xuất
              <input name="campaignTitle" required minLength={8} maxLength={180} className="rounded-[8px] border border-line px-3 py-2 text-sm font-normal" placeholder="Cứu trợ khẩn cấp tại…" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-chamDeep">Mục tiêu dự kiến (VND)
              <input name="campaignTarget" required type="number" min={100000} max={100000000000} step={1} className="rounded-[8px] border border-line px-3 py-2 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-chamDeep">Email liên hệ (không bắt buộc)
              <input name="campaignEmail" type="email" className="rounded-[8px] border border-line px-3 py-2 text-sm font-normal" />
            </label>
          </div>
        ) : null}
      </div>

      <button className="button-primary w-full" type="submit" disabled={loading}>
        {loading ? "Đang gửi…" : "🚨 Phát tín hiệu SOS ngay"}
      </button>
    </form>
  );
}
