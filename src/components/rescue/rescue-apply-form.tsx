"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitRescueApplication } from "@/app/rescue/apply/actions";
import { PROVINCES } from "@/lib/geo/provinces";
import { RESCUE_RESOURCE_TYPES } from "@/lib/rescue/resource-types";

export function RescueApplyForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await submitRescueApplication(formData);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSuccess(result.message);
    router.refresh();
  }

  if (success) {
    return <div className="rounded-[14px] border border-lua/30 bg-lua/10 p-6 text-sm text-lua">{success}</div>;
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-[14px] border border-line bg-white p-6">
      {error ? <p className="rounded-[8px] bg-son/10 p-3 text-sm text-son">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm font-semibold text-chamDeep">
          Họ tên liên hệ
          <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="contactName" required />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-chamDeep">
          Tên đội (nếu có)
          <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="teamName" placeholder="VD: Đội Cứu trợ Hà Giang 01" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm font-semibold text-chamDeep">
          Email liên hệ
          <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="contactEmail" type="email" required />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-chamDeep">
          Số điện thoại
          <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="contactPhone" type="tel" required />
        </label>
      </div>

      <label className="grid gap-1 text-sm font-semibold text-chamDeep">
        Tổ chức liên kết (nếu có)
        <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="affiliatedOrganization" placeholder="VD: Hội Chữ thập đỏ tỉnh…" />
      </label>

      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-semibold text-chamDeep">Loại nguồn lực</legend>
        <div className="flex flex-wrap gap-3">
          {RESCUE_RESOURCE_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-1.5 text-sm text-inkMid">
              <input type="checkbox" name="resourceTypes" value={type} className="h-4 w-4" />
              {type}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm font-semibold text-chamDeep">
          Tỉnh/thành hoạt động
          <select className="rounded-[8px] border border-line bg-white px-4 py-3 text-sm font-normal" name="province">
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-chamDeep">
          Bán kính hoạt động (km)
          <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="radiusKm" type="number" min={1} max={500} defaultValue={20} required />
        </label>
      </div>

      <label className="grid gap-1 text-sm font-semibold text-chamDeep">
        Tài liệu năng lực (tuỳ chọn, tối đa 3 tệp — PDF/JPG/PNG)
        <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="evidence" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple />
      </label>

      <p className="rounded-[8px] bg-paper p-3 text-xs leading-5 text-inkMid">
        Gửi hồ sơ không tự kích hoạt tài khoản. Chỉ Admin xem xét và cấp quyền điều phối cứu trợ sau khi duyệt.
      </p>

      <button className="button-primary w-full" type="submit" disabled={loading}>
        {loading ? "Đang gửi…" : "Gửi hồ sơ đăng ký →"}
      </button>
    </form>
  );
}
