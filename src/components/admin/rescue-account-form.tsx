"use client";

import { useState } from "react";
import { createRescueAccount } from "@/app/admin/actions";
import { PROVINCES } from "@/lib/geo/provinces";
import { RESCUE_RESOURCE_TYPES } from "@/lib/rescue/resource-types";

export function RescueAccountForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await createRescueAccount(formData);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSuccess(result.message);
  }

  return (
    <form action={handleSubmit} className="mt-4 grid gap-3 rounded-[10px] border border-line bg-paper p-4">
      {error ? <p className="rounded-[8px] bg-son/10 p-3 text-sm text-son">{error}</p> : null}
      {success ? <p className="rounded-[8px] bg-lua/10 p-3 text-sm text-lua">{success}</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold text-chamDeep">
          Email người nhận lời mời
          <input name="email" type="email" required className="rounded-[7px] border border-line bg-white px-3 py-2.5 text-sm font-normal" placeholder="doitruong@example.com" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-chamDeep">
          Người liên hệ
          <input name="contactName" required className="rounded-[7px] border border-line bg-white px-3 py-2.5 text-sm font-normal" placeholder="Nguyễn Văn A" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-chamDeep">
          Tên đội cứu trợ
          <input name="teamName" required className="rounded-[7px] border border-line bg-white px-3 py-2.5 text-sm font-normal" placeholder="Đội cứu trợ Hà Giang" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-chamDeep">
          Số điện thoại (tuỳ chọn)
          <input name="contactPhone" type="tel" className="rounded-[7px] border border-line bg-white px-3 py-2.5 text-sm font-normal" placeholder="09xx xxx xxx" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-chamDeep">
          Tỉnh/thành hoạt động
          <select name="province" defaultValue={PROVINCES[0]} className="rounded-[7px] border border-line bg-white px-3 py-2.5 text-sm font-normal">
            {PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-chamDeep">
          Bán kính hoạt động (km)
          <input name="radiusKm" type="number" min={1} max={500} defaultValue={20} required className="rounded-[7px] border border-line bg-white px-3 py-2.5 text-sm font-normal" />
        </label>
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="text-xs font-semibold text-chamDeep">Nguồn lực đội cứu trợ</legend>
        <div className="flex flex-wrap gap-3">
          {RESCUE_RESOURCE_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-1.5 text-xs text-inkMid">
              <input type="checkbox" name="resourceTypes" value={type} className="h-4 w-4" />
              {type}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="rounded-[8px] bg-white p-3 text-xs leading-5 text-inkMid">
        Hệ thống sẽ tạo role <strong>rescue_team</strong>, tạo hồ sơ đội ở trạng thái chờ kích hoạt và gửi link đặt mật khẩu qua email. Mật khẩu không hiển thị cho Admin.
      </p>

      <button type="submit" disabled={loading} className="button-primary justify-self-start disabled:cursor-wait disabled:opacity-60">
        {loading ? "Đang tạo và gửi lời mời…" : "Thêm tài khoản đội cứu trợ"}
      </button>
    </form>
  );
}
