"use client";

import { useMemo, useState } from "react";

type TabKey = "finance" | "quarterly" | "biannual" | "campaign" | "beneficiary" | "org";

const PREVIEW_NOTICE = "Đây là bản mẫu: báo cáo và tệp tải về chưa được tạo. Tính năng sẽ mở khi hoàn thiện.";

const quarters = [
  { key: "q1", label: "Q1-2026", range: "01/01 - 31/03", amount: "000tr", campaigns: "000 chiến dịch", borderClass: "border-t-son", labelClass: "text-son", state: "done" },
  { key: "q2", label: "Q2-2026", range: "01/04 - 30/06", amount: "000tr", campaigns: "000 chiến dịch", borderClass: "border-t-nghe", labelClass: "text-ngheDeep", state: "done" },
  { key: "q3", label: "Q3-2026", range: "01/07 - 30/09", amount: "—", campaigns: "Đang diễn ra", borderClass: "border-t-sky", labelClass: "text-sky", state: "running" },
] as const;

const closedCampaigns = [
  { icon: "🏫", iconClass: "bg-luaSoft", name: "Chiến dịch mẫu — xây trường mầm non", detail: "Đóng cổng (ngày mẫu) · 000.000.000đ thu · 000.000.000đ giải ngân" },
  { icon: "🏥", iconClass: "bg-sonSoft", name: "Chiến dịch mẫu — học bổng vượt khó", detail: "Đóng cổng (ngày mẫu) · 000.000.000đ thu · 100% giải ngân" },
  { icon: "💧", iconClass: "bg-skySoft", name: "Chiến dịch mẫu — nước sạch cho trường học", detail: "Đóng cổng (ngày mẫu) · 000.000.000đ thu · 000.000.000đ giải ngân" },
] as const;

const beneficiaries = [
  { icon: "👨‍👩‍👧", name: "Hộ gia đình A.B.C", loc: "Thôn mẫu, huyện mẫu", support: "Học bổng cho 2 con", verify: "Xác thực (mẫu)", category: "Giáo dục" },
  { icon: "👩", name: "Bà D.E.F (66 tuổi)", loc: "Xã mẫu, tỉnh mẫu", support: "Chi phí phẫu thuật đục thủy tinh thể", verify: "Xác thực (mẫu)", category: "Y tế" },
  { icon: "👦", name: "Em G.H.I (học sinh lớp 10)", loc: "Trường mẫu, tỉnh mẫu", support: "Học bổng theo tháng", verify: "Xác thực (mẫu)", category: "Giáo dục" },
] as const;

const organizations = [
  { icon: "🏫", name: "Tổ chức mẫu A", meta: "Hà Nội · Giáo dục · 00 chiến dịch", total: "0.0 tỷ" },
  { icon: "🥢", name: "Tổ chức mẫu B", meta: "Hà Nội · Giáo dục / Bữa ăn · 00 chiến dịch", total: "0.0 tỷ" },
] as const;

const tabs: { key: TabKey; label: string }[] = [
  { key: "finance", label: "Sao kê năm" },
  { key: "quarterly", label: "Báo cáo Quý" },
  { key: "biannual", label: "Bán niên (6 tháng)" },
  { key: "campaign", label: "Theo chiến dịch" },
  { key: "beneficiary", label: "Người thụ hưởng" },
  { key: "org", label: "Tổ chức" },
];

function SampleBadge() {
  return <span className="rounded-full bg-nghe/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ngheDeep">Mẫu</span>;
}

export function TransparencyPreview() {
  const [tab, setTab] = useState<TabKey>("finance");
  const [notice, setNotice] = useState<string | null>(null);
  const [beneficiaryQuery, setBeneficiaryQuery] = useState("");
  const [orgQuery, setOrgQuery] = useState("");

  const visibleBeneficiaries = useMemo(
    () => beneficiaries.filter((item) => `${item.name} ${item.loc}`.toLowerCase().includes(beneficiaryQuery.trim().toLowerCase())),
    [beneficiaryQuery],
  );
  const visibleOrganizations = useMemo(
    () => organizations.filter((item) => `${item.name} ${item.meta}`.toLowerCase().includes(orgQuery.trim().toLowerCase())),
    [orgQuery],
  );

  const Notice = ({ id }: { id: string }) => (notice === id ? <p className="mt-2 w-full rounded-[8px] bg-nghe/10 p-2.5 text-xs text-ngheDeep">{PREVIEW_NOTICE}</p> : null);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => { setTab(item.key); setNotice(null); }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold transition ${tab === item.key ? "border-son text-son" : "border-transparent text-inkSoft hover:text-inkMid"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-5 rounded-[8px] border border-nghe/30 bg-nghe/10 px-4 py-2.5 text-[13px] text-ngheDeep">
        <strong>Bản mẫu giao diện.</strong> Nội dung các tab bên dưới là dữ liệu minh hoạ, chưa có báo cáo, tệp tải về hay mã niêm phong thật. Các thẻ số liệu tổng quan phía trên là số thật từ hệ thống.
      </div>

      {tab === "finance" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-line bg-white px-5 py-4">
            <div>
              <div className="font-serif text-[15px] font-bold text-chamDeep">Năm tài chính 2026</div>
              <div className="mt-0.5 text-xs text-inkSoft">Đang diễn ra · báo cáo và mã niêm phong sẽ có sau khi kết thúc năm</div>
            </div>
            <span className="rounded-full bg-sky/15 px-3 py-1 text-xs font-bold text-sky">Đang diễn ra</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-line bg-white px-5 py-4">
            <div>
              <div className="flex items-center gap-2 font-serif text-[15px] font-bold text-chamDeep">Năm tài chính (mẫu) <SampleBadge /></div>
              <div className="mt-0.5 text-xs text-inkSoft">Mã niêm phong: <span className="font-mono text-[11px]">(hiển thị khi báo cáo được niêm phong)</span> · 000 chiến dịch</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setNotice("fy-view")} className="button-secondary !px-4 !py-2 text-[13px]">Xem sao kê</button>
              <button type="button" onClick={() => setNotice("fy-pdf")} className="button-primary !rounded-[8px] !px-4 !py-2 text-[13px]">Tải PDF →</button>
            </div>
            {notice === "fy-view" || notice === "fy-pdf" ? <p className="w-full rounded-[8px] bg-nghe/10 p-2.5 text-xs text-ngheDeep">{PREVIEW_NOTICE}</p> : null}
          </div>
        </div>
      ) : null}

      {tab === "quarterly" ? (
        <div>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quarters.map((item) => (
              <div key={item.key} className={`rounded-[8px] border border-line border-t-[3px] bg-white p-4 ${item.borderClass}`}>
                <div className="flex items-center justify-between"><div className={`font-serif text-[15px] font-bold ${item.labelClass}`}>{item.label}</div>{item.state === "done" ? <SampleBadge /> : null}</div>
                <div className="text-xs text-inkSoft">{item.range}</div>
                <div className="my-2 font-serif text-lg font-bold text-chamDeep">{item.amount}</div>
                <div className="text-[11.5px] text-lua">{item.campaigns}</div>
                {item.state === "done" ? (
                  <>
                    <button type="button" onClick={() => setNotice(item.key)} className="mt-2.5 w-full rounded-[4px] border border-line bg-paper px-2.5 py-1.5 text-[11.5px] hover:border-son">Xuất CSV</button>
                    <Notice id={item.key} />
                  </>
                ) : null}
              </div>
            ))}
            <div className="rounded-[8px] border-[1.5px] border-dashed border-lineStrong bg-paper p-4 text-center">
              <div className="font-serif text-[15px] font-bold text-inkSoft">Q4-2026</div>
              <div className="text-xs text-inkSoft">01/10 - 31/12</div>
              <div className="mt-5 text-[11px] text-inkSoft">Chưa bắt đầu</div>
            </div>
          </div>
          <div className="rounded-[4px] bg-paper px-3.5 py-3 text-[13px] text-inkMid">Định hướng: báo cáo mỗi quý được chốt và niêm phong cuối kỳ để không thể sửa số liệu sau đó. Tính năng này đang phát triển.</div>
        </div>
      ) : null}

      {tab === "biannual" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[14px] border border-line bg-white p-5">
            <div className="mb-3.5 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sonSoft text-sm font-bold">H1</div>
              <div><div className="flex items-center gap-2 font-serif text-[15px] font-bold text-chamDeep">Bán niên 1 (mẫu) <SampleBadge /></div><div className="text-xs text-inkSoft">01/01 - 30/06</div></div>
            </div>
            <div className="mb-4 flex flex-col text-[13px]">
              {[["Tổng thu", "000.000.000đ", "text-son"], ["Tổng chi (giải ngân 90%)", "000.000.000đ", "text-lua"], ["Vận hành (10%)", "000.000.000đ", "text-chamDeep"], ["Chiến dịch", "000 chiến dịch", "text-sky"]].map(([label, value, cls]) => (
                <div key={label} className="flex justify-between border-b border-line py-2 last:border-b-0"><span className="text-inkSoft">{label}</span><span className={`font-serif font-bold ${cls}`}>{value}</span></div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setNotice("h1-pdf")} className="button-primary flex-1 !rounded-[8px] !py-2.5 text-[13px]">Xuất PDF</button>
              <button type="button" onClick={() => setNotice("h1-csv")} className="button-secondary flex-1 !rounded-[8px] !py-2.5 text-[13px]">Xuất CSV</button>
            </div>
            <Notice id="h1-pdf" /><Notice id="h1-csv" />
          </div>
          <div className="flex flex-col items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-lineStrong bg-paper p-6 text-center">
            <div className="mb-3 text-3xl">🕑</div>
            <div className="mb-1.5 font-serif text-[15px] font-bold text-inkMid">Bán niên 2 (H2-2026)</div>
            <div className="mb-3 text-[13px] text-inkSoft">01/07/2026 - 31/12/2026</div>
            <div className="text-xs text-inkSoft">Chưa kết thúc. Báo cáo sẽ được phát hành sau khi kết thúc kỳ.</div>
          </div>
        </div>
      ) : null}

      {tab === "campaign" ? (
        <div>
          <p className="mb-4 text-sm text-inkMid">Chiến dịch đã đóng cổng sẽ có báo cáo minh bạch đầy đủ tại đây. Hiện tại chưa có chiến dịch nào đóng; các thẻ dưới đây minh hoạ bố cục.</p>
          <div className="flex flex-col gap-3">
            {closedCampaigns.map((item) => (
              <div key={item.name} className="flex flex-wrap items-center gap-3.5 rounded-[8px] border border-line bg-white p-4">
                <div className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-lg ${item.iconClass}`}>{item.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-serif text-sm font-bold text-chamDeep">{item.name} <SampleBadge /></div>
                  <div className="text-xs text-inkSoft">{item.detail}</div>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-luaSoft px-2.5 py-0.5 text-[11.5px] font-bold text-lua">Đã đóng</span>
                  <button type="button" onClick={() => setNotice(item.name)} className="mt-1 block text-[11.5px] font-semibold text-sky">Xem báo cáo →</button>
                </div>
                <Notice id={item.name} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "beneficiary" ? (
        <div>
          <div className="mb-4 rounded-[8px] border border-nghe/30 bg-ngheXsoft px-4 py-3 text-[13px] text-ngheDeep">
            Tab này đang chờ chốt quy trình xác thực người thụ hưởng và cơ sở pháp lý về việc công khai thông tin. Nội dung dưới đây chỉ minh hoạ bố cục, toàn bộ thông tin là giả định và đã ẩn danh.
          </div>
          <div className="mb-4 flex gap-2">
            <input value={beneficiaryQuery} onChange={(event) => setBeneficiaryQuery(event.target.value)} placeholder="Tìm theo tỉnh, huyện…" className="flex-1 rounded-[8px] border border-line px-4 py-2.5 text-sm outline-none focus:border-son" />
          </div>
          <div className="flex flex-col gap-2.5">
            {visibleBeneficiaries.length === 0 ? <div className="rounded-[14px] border-2 border-dashed border-lineStrong bg-paperMid p-8 text-center text-sm text-inkMid">Không tìm thấy kết quả.</div> : null}
            {visibleBeneficiaries.map((item) => (
              <div key={item.name} className="flex flex-wrap items-start gap-3.5 rounded-[8px] border border-line bg-white p-4">
                <div className="text-2xl">{item.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-serif text-sm font-bold text-chamDeep">{item.name} <SampleBadge /></div>
                  <div className="text-xs text-inkSoft">{item.loc}</div>
                  <div className="mt-1 text-[12.5px] text-inkMid">{item.support}</div>
                  <span className="mt-1.5 inline-block rounded-[3px] bg-luaSoft px-2 py-0.5 text-[11px] font-bold text-lua">✓ {item.verify}</span>
                </div>
                <span className="rounded-[3px] bg-ngheXsoft px-2.5 py-0.5 text-[11.5px] font-bold text-ngheDeep">{item.category}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "org" ? (
        <div>
          <div className="mb-4 flex gap-2">
            <input value={orgQuery} onChange={(event) => setOrgQuery(event.target.value)} placeholder="Tìm tổ chức…" className="flex-1 rounded-[8px] border border-line px-4 py-2.5 text-sm outline-none focus:border-son" />
          </div>
          <div className="flex flex-col gap-2.5">
            {visibleOrganizations.length === 0 ? <div className="rounded-[14px] border-2 border-dashed border-lineStrong bg-paperMid p-8 text-center text-sm text-inkMid">Không tìm thấy tổ chức.</div> : null}
            {visibleOrganizations.map((item) => (
              <div key={item.name} className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-line bg-white px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chamSoft text-[17px]">{item.icon}</div>
                  <div>
                    <div className="flex items-center gap-2 font-serif text-sm font-bold text-chamDeep">{item.name} <SampleBadge /></div>
                    <div className="text-xs text-inkSoft">{item.meta}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-son">{item.total}</span>
                  <span className="rounded-[3px] bg-luaSoft px-2 py-0.5 text-[11px] font-bold text-lua">✓ Xác thực</span>
                  <button type="button" onClick={() => setNotice(item.name)} className="button-secondary !px-3 !py-1.5 text-xs">Xem hồ sơ</button>
                </div>
                <Notice id={item.name} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
