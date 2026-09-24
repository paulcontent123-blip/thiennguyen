"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type OfferType = "item" | "skill" | "transport";
type ResTab = "items" | "volunteer" | "transport";
type SkillFilter = "all" | "y-te" | "xay-dung" | "day-hoc" | "nau-an";

const PREVIEW_NOTICE = "Đây là bản mẫu: thông tin chưa được lưu và chưa kết nối tới ai. Tính năng sẽ mở khi hoàn thiện.";

const wishlist = [
  { icon: "📦", name: "Gạo ST25 — 50kg/túi", need: 80, claimed: 35, unit: "túi", org: "Chiến dịch mẫu — bữa cơm bán trú", loc: "Lào Cai" },
  { icon: "📚", name: "Bộ sách giáo khoa lớp 1", need: 200, claimed: 88, unit: "bộ", org: "Chiến dịch mẫu — sách cho em", loc: "Quảng Bình" },
  { icon: "🧥", name: "Áo ấm trẻ em (size 6–12 tuổi)", need: 150, claimed: 42, unit: "cái", org: "Chiến dịch mẫu — mùa đông vùng cao", loc: "Lai Châu" },
  { icon: "🏥", name: "Thuốc cảm cúm (hộp 20 viên)", need: 500, claimed: 210, unit: "hộp", org: "Chiến dịch mẫu — cứu trợ lũ", loc: "Nghệ An" },
  { icon: "🛖", name: "Tấm bạt chống thấm (3x4m)", need: 60, claimed: 18, unit: "tấm", org: "Chiến dịch mẫu — cứu trợ lũ", loc: "Nghệ An" },
  { icon: "✏️", name: "Bút vở dụng cụ học tập (combo)", need: 300, claimed: 156, unit: "combo", org: "Chiến dịch mẫu — học bổng vượt khó", loc: "Hà Giang" },
] as const;

const volunteers = [
  { icon: "👨", name: "Anh Minh (Hà Nội)", skills: ["Y tế", "Sơ cấp cứu"], category: "y-te", radius: "≤ 20km", availability: "Cuối tuần" },
  { icon: "🚛", name: "Chị Lan (Đà Nẵng)", skills: ["Xe tải 1.5T", "Nấu ăn tập thể"], category: "nau-an", radius: "≤ 50km", availability: "Linh hoạt" },
  { icon: "👩", name: "Nhóm tình nguyện sinh viên", skills: ["Dạy học", "Tiếng Anh", "IT"], category: "day-hoc", radius: "≤ 10km", availability: "Thứ 7, Chủ nhật" },
  { icon: "👷", name: "Kỹ sư Hùng (TP.HCM)", skills: ["Kỹ sư xây dựng", "Giám sát thi công"], category: "xay-dung", radius: "≤ 30km", availability: "Cuối tuần" },
] as const;

const vehicles = [
  { icon: "🚚", name: "Xe tải 5T — Nghệ An", detail: "3 chuyến sẵn sàng · phạm vi 100km", tag: "0đ (từ thiện)", tagClass: "text-lua" },
  { icon: "⛵", name: "Xuồng máy — Hà Giang", detail: "2 xuồng · khu vực sông nguy hiểm", tag: "Khẩn cấp — sẵn sàng đi ngay", tagClass: "text-son" },
] as const;

const skillFilters: { key: SkillFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "y-te", label: "🏥 Y tế" },
  { key: "xay-dung", label: "👷 Xây dựng" },
  { key: "day-hoc", label: "📚 Dạy học" },
  { key: "nau-an", label: "🍳 Nấu ăn" },
];

const inputClass = "rounded-[8px] border border-line px-3 py-2.5 text-sm font-normal outline-none focus:border-son";
const labelClass = "grid gap-1 text-xs font-bold text-chamDeep";

function SampleBadge() {
  return <span className="rounded-full bg-nghe/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ngheDeep">Mẫu</span>;
}

export function DonateItemsPreview() {
  const [offerType, setOfferType] = useState<OfferType>("item");
  const [resTab, setResTab] = useState<ResTab>("items");
  const [skillFilter, setSkillFilter] = useState<SkillFilter>("all");
  const [offerNotice, setOfferNotice] = useState(false);
  const [noticeKey, setNoticeKey] = useState<string | null>(null);

  function handleOfferSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOfferNotice(true);
  }

  function showNotice(key: string) {
    setNoticeKey(key);
  }

  const visibleVolunteers = skillFilter === "all" ? volunteers : volunteers.filter((item) => item.category === skillFilter);

  const offerTabs: { key: OfferType; label: string }[] = [
    { key: "item", label: "📦 Hiện vật" },
    { key: "skill", label: "🤝 Ngày công / Kỹ năng" },
    { key: "transport", label: "🚚 Xe vận chuyển" },
  ];

  const resTabs: { key: ResTab; label: string }[] = [
    { key: "items", label: "📦 Vật phẩm cần nhận" },
    { key: "volunteer", label: "🤝 Ngày công / Kỹ năng" },
    { key: "transport", label: "🚚 Xe vận chuyển" },
  ];

  return (
    <div>
      <div className="border-b border-nghe/30 bg-nghe/10 px-7 py-2.5 text-center text-[13px] text-ngheDeep">
        <strong>Bản mẫu giao diện.</strong> Tính năng đóng góp nguồn lực đang phát triển — toàn bộ thẻ dưới đây là dữ liệu minh hoạ, chưa gắn với hệ thống thật.
      </div>

      <section className="mx-auto max-w-[1160px] px-7 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Nguồn lực cộng đồng</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-chamDeep sm:text-4xl">Không chỉ là tiền — Đóng góp đa hình thức</h1>
            <p className="mt-3 max-w-2xl leading-7 text-inkMid">Gạo, quần áo, ngày công, xe vận chuyển — tạo tác động thật không cần rút ví.</p>
          </div>
          <a href="#offer-card" className="button-primary">+ Đăng ký đóng góp nguồn lực</a>
        </div>

        {/* OFFER CARD */}
        <div id="offer-card" className="mt-8 scroll-mt-24 rounded-[14px] border border-line bg-white p-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-serif text-lg font-semibold text-chamDeep">🎁 Bạn có nguồn lực muốn đóng góp?</div>
            <SampleBadge />
          </div>
          <p className="mt-1 text-sm text-inkMid">Gạo, sữa, quần áo, thuốc men, ngày công kỹ thuật hay xe vận chuyển — dự kiến được ghi nhận và quy đổi giá trị VND cho báo cáo tác động.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {offerTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setOfferType(tab.key); setOfferNotice(false); }}
                className={`rounded-full border-[1.5px] px-4 py-1.5 text-[13px] font-medium transition ${offerType === tab.key ? "border-son bg-son text-white" : "border-lineStrong bg-white text-inkMid hover:border-son hover:text-son"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleOfferSubmit} className="mt-4">
            {offerType === "item" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Loại hiện vật
                  <select className={inputClass}>{["Gạo", "Sữa", "Mì tôm", "Quần áo", "Chăn màn", "Thuốc men", "Thiết bị y tế", "Khác…"].map((item) => <option key={item}>{item}</option>)}</select>
                </label>
                <label className={labelClass}>Số lượng<input className={inputClass} placeholder="VD: 50 kg gạo" /></label>
                <label className={labelClass}>Giá trị quy đổi (VND)<input className={`${inputClass} bg-paperDeep`} placeholder="Hệ thống sẽ tự tính (sắp có)" readOnly /></label>
                <label className={labelClass}>Tỉnh / Khu vực<input className={inputClass} placeholder="VD: Hà Nội, TP.HCM…" /></label>
              </div>
            ) : null}
            {offerType === "skill" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Chuyên môn
                  <select className={inputClass}>{["Bác sĩ / Y tế", "Kỹ sư xây dựng", "Giáo viên", "IT / Công nghệ", "Nấu ăn", "Lái xe", "Khác…"].map((item) => <option key={item}>{item}</option>)}</select>
                </label>
                <label className={labelClass}>Số ngày công<input className={inputClass} type="number" min={1} placeholder="VD: 3" /></label>
                <label className={labelClass}>Thời gian có thể<input className={inputClass} type="date" /></label>
                <label className={labelClass}>Khu vực<input className={inputClass} placeholder="Trong vòng … km" /></label>
              </div>
            ) : null}
            {offerType === "transport" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Loại phương tiện
                  <select className={inputClass}>{["Xe tải nhỏ", "Xe tải vừa", "Xe tải lớn", "Xuồng máy", "Ô tô 7 chỗ"].map((item) => <option key={item}>{item}</option>)}</select>
                </label>
                <label className={labelClass}>Số chuyến<input className={inputClass} type="number" min={1} placeholder="VD: 4" /></label>
                <label className={labelClass}>Xuất phát từ<input className={inputClass} placeholder="Tỉnh / TP" /></label>
                <label className={labelClass}>Phạm vi<input className={inputClass} placeholder="VD: 100km" /></label>
              </div>
            ) : null}
            <button type="submit" className="button-primary mt-4">
              {offerType === "item" ? "Xác nhận đóng góp" : offerType === "skill" ? "Xác nhận ngày công" : "Xác nhận cung cấp xe"}
            </button>
            {offerNotice ? <p className="mt-3 rounded-[8px] bg-nghe/10 p-3 text-sm text-ngheDeep">{PREVIEW_NOTICE}</p> : null}
          </form>
        </div>

        {/* TABS */}
        <div className="mt-10 flex flex-wrap gap-1 border-b border-line">
          {resTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setResTab(tab.key); setNoticeKey(null); }}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold transition ${resTab === tab.key ? "border-son text-son" : "border-transparent text-inkSoft hover:text-inkMid"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {resTab === "items" ? (
          <div className="mt-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-nghe/30 bg-ngheXsoft px-4 py-3">
              <div className="text-sm text-ngheDeep">💡 <strong>Không biết cần gì?</strong> Ủng hộ tiền trực tiếp cho chiến dịch bạn quan tâm — nhà tổ chức sẽ mua đúng thứ đang cần.</div>
              <Link href="/campaigns" className="button-primary whitespace-nowrap">Xem chiến dịch →</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {wishlist.map((item) => {
                const percent = Math.round((item.claimed / item.need) * 100);
                const key = `wish-${item.name}`;
                return (
                  <div key={item.name} className="overflow-hidden rounded-[14px] border border-line bg-white">
                    <div className="relative flex h-24 items-center justify-center bg-paperMid text-4xl">
                      {item.icon}
                      <div className="absolute right-2 top-2"><SampleBadge /></div>
                      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-paperDeep"><div className="h-full bg-lua" style={{ width: `${percent}%` }} /></div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-1.5 text-xs text-inkSoft"><span className="h-2 w-2 rounded-full bg-lua" />{item.org}</div>
                      <div className="mt-1 font-serif text-base font-semibold text-chamDeep">{item.name}</div>
                      <div className="mt-0.5 text-xs text-inkSoft">📍 {item.loc}</div>
                      <div className="mt-2 text-[12.5px] text-inkMid">{item.claimed} / {item.need} {item.unit} đã nhận · {percent}%</div>
                      <button type="button" onClick={() => showNotice(key)} className="button-primary mt-3 w-full !py-2 text-[13px]">Nhận vật phẩm này →</button>
                      {noticeKey === key ? <p className="mt-2 rounded-[8px] bg-nghe/10 p-2 text-xs text-ngheDeep">{PREVIEW_NOTICE}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {resTab === "volunteer" ? (
          <div className="mt-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {skillFilters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSkillFilter(item.key)}
                  className={`rounded-full border-[1.5px] px-4 py-1.5 text-[13px] font-medium transition ${skillFilter === item.key ? "border-son bg-son text-white" : "border-lineStrong bg-white text-inkMid hover:border-son hover:text-son"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {visibleVolunteers.length === 0 ? <div className="rounded-[14px] border-2 border-dashed border-lineStrong bg-paperMid p-8 text-center text-sm text-inkMid">Chưa có tình nguyện viên ở nhóm này.</div> : null}
              {visibleVolunteers.map((item) => {
                const key = `vol-${item.name}`;
                return (
                  <div key={item.name} className="flex items-start gap-4 rounded-[14px] border border-line bg-white p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paperMid text-2xl">{item.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-serif text-base font-semibold text-chamDeep">{item.name}</span><SampleBadge /></div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">{item.skills.map((skill) => <span key={skill} className="rounded-[4px] bg-skySoft px-2 py-0.5 text-[11px] font-bold text-sky">{skill}</span>)}</div>
                      <div className="mt-1.5 text-xs text-inkSoft">Bán kính: {item.radius} · {item.availability}</div>
                      <button type="button" onClick={() => showNotice(key)} className="mt-2 rounded-[8px] bg-chamDeep px-3.5 py-1.5 text-[12.5px] font-bold text-white transition hover:bg-chamDeep/90">Liên hệ ngay</button>
                      {noticeKey === key ? <p className="mt-2 rounded-[8px] bg-nghe/10 p-2 text-xs text-ngheDeep">{PREVIEW_NOTICE}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {resTab === "transport" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((item) => {
              const key = `veh-${item.name}`;
              return (
                <div key={item.name} className="rounded-[14px] border border-line bg-white p-4">
                  <div className="flex items-start justify-between"><div className="text-2xl">{item.icon}</div><SampleBadge /></div>
                  <div className="mt-2 font-serif text-base font-semibold text-chamDeep">{item.name}</div>
                  <div className="mt-1.5 text-xs text-inkSoft">{item.detail}</div>
                  <div className={`mt-1.5 text-xs font-bold ${item.tagClass}`}>{item.tag}</div>
                  <button type="button" onClick={() => showNotice(key)} className="button-primary mt-3 w-full !py-2 text-[13px]">📞 Liên hệ điều phối</button>
                  {noticeKey === key ? <p className="mt-2 rounded-[8px] bg-nghe/10 p-2 text-xs text-ngheDeep">{PREVIEW_NOTICE}</p> : null}
                </div>
              );
            })}
            <div className="flex flex-col items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-lineStrong bg-paper p-4 text-center">
              <div className="text-3xl text-inkSoft">+</div>
              <div className="text-sm font-bold text-son">Đăng ký cung cấp xe</div>
              <button
                type="button"
                onClick={() => { setOfferType("transport"); setOfferNotice(false); document.getElementById("offer-card")?.scrollIntoView({ behavior: "smooth" }); }}
                className="button-secondary !py-2 text-[13px]"
              >
                Đăng ký ngay
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
