"use client";

import { useMemo, useState } from "react";

const currency = new Intl.NumberFormat("vi-VN");
const PRESET_COMMUNITY_AMOUNT = 100_000_000;

export function MatchingFundCalculator() {
  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(2);

  const corpMatch = useMemo(() => PRESET_COMMUNITY_AMOUNT * (multiplier - 1), [multiplier]);
  const total = PRESET_COMMUNITY_AMOUNT + corpMatch;
  const corpShare = total > 0 ? Math.round((corpMatch / total) * 100) : 0;

  return (
    <div className="rounded-[14px] border border-line bg-white p-6">
      <div className="mb-4 text-sm font-bold text-chamDeep">Mô phỏng Matching Fund (ước tính)</div>

      <div className="mb-3.5">
        <div className="mb-1.5 text-xs text-inkSoft">Cộng đồng quyên góp được</div>
        <div className="font-mono text-2xl font-bold text-chamDeep">{currency.format(PRESET_COMMUNITY_AMOUNT)}đ</div>
      </div>

      <div className="mb-3.5 flex gap-2">
        {([1, 2, 3] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMultiplier(value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
              multiplier === value ? "border-son text-son" : "border-lineStrong text-inkMid hover:border-son hover:text-son"
            }`}
          >
            {value === 1 ? "X1 (1:1)" : `X${value}`}
          </button>
        ))}
      </div>

      <div className="rounded-[8px] bg-paper p-4">
        <div className="mb-1 text-xs text-inkSoft">Doanh nghiệp đối ứng thêm</div>
        <div className="font-mono text-xl font-bold text-son">{currency.format(corpMatch)}đ</div>
        <div className="my-2.5 h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-gradient-to-r from-son to-nghe transition-all" style={{ width: `${corpShare}%` }} />
        </div>
        <div className="mt-2 font-mono text-xl font-bold text-lua">= {currency.format(total)}đ tác động</div>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-inkSoft">
        Đây là công cụ ước tính để tham khảo, chưa gắn với dữ liệu quyên góp thực tế của một chiến dịch cụ thể.
      </p>
    </div>
  );
}
