import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { CampaignCard, type CampaignCardData } from "@/components/campaign-card";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

async function getActiveCampaigns(): Promise<CampaignCardData[]> {
  if (!hasSupabaseEnv()) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("slug, title, summary, target_amount")
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(8);

  return (data ?? []).map((row) => ({
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    targetAmount: Number(row.target_amount),
  }));
}

const currency = new Intl.NumberFormat("vi-VN");

const partners = [
  ["\u{1F3E5}", "Bệnh viện Bạch Mai"],
  ["\u{1F3E6}", "Vietcombank"],
  ["❤️", "Hội Chữ thập đỏ VN"],
  ["\u{1F3EB}", "UNICEF Việt Nam"],
] as const;

const stats = [
  ["Tổ chức", "0", "bg-sky"],
  ["Cá nhân", "0", "bg-nghe"],
  ["Chiến dịch", "0", "bg-son"],
  ["Thành viên", "0", "bg-lua"],
  ["Lượt ủng hộ", "0", "bg-nghe"],
  ["Số tiền (tỷ)", "0", "bg-skySoft"],
] as const;

const howSteps = [
  ["01", "Tìm chiến dịch đã xác thực", "Lọc theo hạng mục, khu vực hoặc loại đóng góp. Mọi tổ chức đều được xác minh giấy phép hoạt động."],
  ["02", "Ủng hộ qua VietQR động", "Scan mã QR sinh tự động — deep link kích hoạt thẳng app ngân hàng, tự điền sẵn TK, số tiền, nội dung."],
  ["03", "Theo dõi từng đồng đến tay người nhận", "Xem Cashflow Tree: tiền biến thành gạo, sách vở hay vật tư y tế gì — có hóa đơn VAT và ảnh GPS thực địa."],
] as const;

export default async function HomePage() {
  const campaigns = await getActiveCampaigns();
  const [heroMain, ...heroRest] = campaigns;
  const heroSub = heroRest.slice(0, 2);

  return (
    <main>
      <SiteHeader />

      {/* HERO GRID */}
      <section className="mx-auto grid max-w-[1160px] grid-cols-1 gap-4 px-7 pt-7 md:grid-cols-[1.6fr_1fr]">
        {heroMain ? (
          <Link href={`/campaigns/${encodeURIComponent(heroMain.slug)}`} className="group relative flex h-[420px] flex-col justify-end overflow-hidden rounded-[14px] bg-gradient-to-br from-[#5C3317] to-[#8B4513] p-7 text-white">
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="relative">
              <span className="inline-block rounded-[4px] bg-white/15 px-2.5 py-1 text-xs font-bold">Chiến dịch nổi bật</span>
              <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight">{heroMain.title}</h2>
              <p className="mt-2 max-w-lg text-sm text-white/80">{heroMain.summary}</p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-mono font-bold">{currency.format(heroMain.targetAmount)}đ mục tiêu</span>
              </div>
              <button className="button-primary mt-4">&#10084; Ủng hộ ngay</button>
            </div>
          </Link>
        ) : (
          <div className="flex h-[420px] flex-col items-center justify-center gap-4 rounded-[14px] border-2 border-dashed border-lineStrong bg-paperMid text-center">
            <span className="text-5xl">&#127974;</span>
            <p className="max-w-sm font-serif text-xl font-semibold text-chamDeep">Chưa có chiến dịch nào được duyệt</p>
            <p className="max-w-sm text-sm text-inkMid">Chiến dịch sẽ hiển thị tại đây ngay khi Admin duyệt xong hồ sơ đầu tiên.</p>
            <div className="mt-2 flex gap-3">
              <Link href="/register" className="button-primary">Tạo chiến dịch</Link>
              <Link href="/docs" className="button-secondary">Xem tài liệu MVP</Link>
            </div>
          </div>
        )}

        <div className="grid grid-rows-2 gap-4">
          {[0, 1].map((i) => {
            const c = heroSub[i];
            return c ? (
              <Link key={c.slug} href={`/campaigns/${encodeURIComponent(c.slug)}`} className="group relative flex h-[198px] flex-col justify-end overflow-hidden rounded-[14px] bg-gradient-to-br from-[#1a4a2e] to-[#2d7a4a] p-5 text-white">
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="relative">
                  <h3 className="font-serif text-base font-semibold leading-snug">{c.title}</h3>
                  <span className="mt-1 block font-mono text-sm font-bold">{currency.format(c.targetAmount)}đ</span>
                </div>
              </Link>
            ) : (
              <div key={i} className="flex h-[198px] items-center justify-center rounded-[14px] border border-dashed border-line bg-paperMid text-sm text-inkSoft">
                Chưa có dữ liệu
              </div>
            );
          })}
        </div>
      </section>

      {/* STATS NETWORK */}
      <section className="mt-10 bg-paperMid py-14">
        <div className="mx-auto max-w-[1160px] px-7">
          <h2 className="max-w-xl font-serif text-2xl font-semibold leading-snug text-chamDeep">
            Đồng hành cùng cộng đồng
            <br />
            thiện nguyện minh bạch từ năm 2021
          </h2>
          <p className="mt-2 text-xs text-inkSoft">*Số liệu sẽ nối vào bảng thống kê thật ở đợt tiếp theo — hiện đang là 0.</p>
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map(([label, value, dot]) => (
              <div key={label}>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-inkSoft">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  {label}
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-chamDeep">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PARTNER STRIP */}
      <section className="border-b border-line bg-white py-6">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-6 px-7">
          <span className="whitespace-nowrap border-r border-line pr-6 text-xs font-bold uppercase tracking-wide text-inkSoft">
            Đối tác đồng hành
          </span>
          <div className="flex flex-1 flex-wrap items-center gap-4">
            {partners.map(([icon, name]) => (
              <span key={name} className="flex items-center gap-2 rounded-[40px] border border-line px-4 py-2 text-[13px] font-bold text-chamDeep">
                <span className="text-lg">{icon}</span>
                {name}
              </span>
            ))}
            <Link href="/corporate" className="rounded-[40px] bg-paper px-4 py-2 text-[13px] font-bold text-son">
              +48 đối tác &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ACTIVE CAMPAIGNS */}
      <section className="mx-auto max-w-[1160px] px-7 py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Đang kết nối</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-chamDeep">Chiến dịch đang hoạt động</h2>
          </div>
          <Link href="/campaigns" className="text-sm font-bold text-son">Xem tất cả &rarr;</Link>
        </div>
        {campaigns.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {campaigns.map((c) => (
              <CampaignCard key={c.slug} campaign={c} />
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-lineStrong bg-paperMid p-10 text-center text-sm text-inkMid">
            Chưa có chiến dịch nào ở trạng thái công khai. Khi Admin duyệt xong campaign đầu tiên, danh sách sẽ hiện tại đây.
          </div>
        )}
      </section>

      {/* 2 LOẠI HÌNH CHIẾN DỊCH */}
      <section className="bg-paperMid py-14">
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="mb-8 text-center">
            <p className="eyebrow">2 loại hình chiến dịch</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-chamDeep">Dòng tiền minh bạch — Phù hợp mọi mục đích</h2>
          </div>
          <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
            <div className="panel">
              <div className="text-3xl">&#127974;</div>
              <h3 className="mt-2 font-serif text-lg font-semibold text-chamDeep">Chiến dịch Trực tiếp</h3>
              <p className="mt-1 text-sm leading-6 text-inkMid">
                Quỹ tự triển khai. Hệ thống tự động tách 90/10 theo Nghị định 93/2021/NĐ-CP.
              </p>
              <div className="mt-4 flex h-2 overflow-hidden rounded-full">
                <div className="w-[90%] bg-lua" />
                <div className="w-[10%] bg-nghe" />
              </div>
              <div className="mt-2 flex justify-between text-xs font-bold">
                <span className="text-lua">90% Thực thi</span>
                <span className="text-ngheDeep">10% Vận hành</span>
              </div>
            </div>
            <div className="panel">
              <div className="text-3xl">&#128279;</div>
              <h3 className="mt-2 font-serif text-lg font-semibold text-chamDeep">Chiến dịch Kết nối</h3>
              <p className="mt-1 text-sm leading-6 text-inkMid">
                Chuyển thẳng đến đối tác (Bệnh viện, Quỹ). Nền tảng xác nhận qua Webhook &amp; xuất E-Receipt tự động.
              </p>
              <div className="mt-4 flex flex-col gap-1.5 text-[13px] text-lua">
                <span>&#10003; Không qua tài khoản trung gian</span>
                <span>&#10003; E-Receipt tự động qua email</span>
              </div>
            </div>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {howSteps.map(([num, title, text]) => (
              <div key={num}>
                <div className="font-mono text-2xl font-bold text-son">{num}</div>
                <h4 className="mt-2 font-serif text-base font-semibold text-chamDeep">{title}</h4>
                <p className="mt-1.5 text-sm leading-6 text-inkMid">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
