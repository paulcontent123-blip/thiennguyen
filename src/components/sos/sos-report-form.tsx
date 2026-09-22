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

  if (!isAuthenticated) {
    return (
      <div className="rounded-[14px] border border-line bg-white p-6 text-center">
        <p className="text-sm text-inkMid">Cần đăng nhập để gửi tín hiệu SOS (giúp hạn chế báo ảo khi chưa tích hợp xác minh SĐT).</p>
        <a href="/login?next=/sos" className="button-primary mt-4 inline-flex">
          Đăng nhập để báo SOS
        </a>
      </div>
    );
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

      <button className="button-primary w-full" type="submit" disabled={loading}>
        {loading ? "Đang gửi…" : "🚨 Phát tín hiệu SOS ngay"}
      </button>
    </form>
  );
}
