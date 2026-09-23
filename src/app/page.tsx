import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { CampaignCard, type CampaignCardData } from "@/components/campaign-card";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getHomepageStats } from "@/lib/stats/homepage-stats";

type CampaignOwnerType = "organization" | "individual";

async function getCampaigns(ownerType?: CampaignOwnerType): Promise<CampaignCardData[]> {
  if (!hasSupabaseEnv()) return [];

  const supabase = createClient();
  let campaignsQuery = supabase
    .from("campaigns")
    .select("id, slug, title, summary, target_amount, category, province, owner_type")
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(ownerType === "individual" ? 4 : 8);

  if (ownerType) campaignsQuery = campaignsQuery.eq("owner_type", ownerType);

  const { data, error } = await campaignsQuery;
  if (error) {
    console.error("Failed to load homepage campaigns", error);
    return [];
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const campaignIds = rows.map((row) => row.id);
  const { data: media, error: mediaError } = await supabase
    .from("campaign_media")
    .select("campaign_id, url, thumbnail_url")
    .in("campaign_id", campaignIds)
    .eq("media_type", "cover")
    .eq("is_public", true)
    .order("sort_order", { ascending: true });

  if (mediaError) console.warn("Homepage campaign covers are unavailable", mediaError.code);
  const coverByCampaign = new Map<string, string>();
  for (const item of media ?? []) {
    if (!coverByCampaign.has(item.campaign_id)) coverByCampaign.set(item.campaign_id, item.thumbnail_url || item.url);
  }

  const summaries = await Promise.all(rows.map(async (row) => {
    const { data: summary, error: summaryError } = await supabase.rpc("get_campaign_donation_summary", { p_campaign_id: row.id });
    if (summaryError) {
      console.warn("Homepage campaign summary is unavailable", { campaignId: row.id, code: summaryError.code });
      return [row.id, 0] as const;
    }
    const summaryRow = Array.isArray(summary) ? summary[0] : summary;
    return [row.id, Number(summaryRow?.total_amount_vnd ?? 0)] as const;
  }));
  const receivedByCampaign = new Map(summaries);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    targetAmount: Number(row.target_amount),
    category: row.category,
    province: row.province,
    ownerType: row.owner_type,
    coverUrl: coverByCampaign.get(row.id) ?? null,
    receivedAmount: receivedByCampaign.get(row.id) ?? 0,
  }));
}

const currency = new Intl.NumberFormat("vi-VN");

const partners = [
  ["\u{1F3E5}", "Bệnh viện Bạch Mai"],
  ["\u{1F3E6}", "Vietcombank"],
  ["❤️", "Hội Chữ thập đỏ VN"],
  ["\u{1F3EB}", "UNICEF Việt Nam"],
] as const;

const networkNodes = [
  { icon: "🏫", kind: "org", top: "9%", left: "54%", label: "Tổ chức giáo dục" },
  { icon: "👤", kind: "person", top: "18%", left: "18%", label: "Nhà hảo tâm" },
  { icon: "🏥", kind: "org", top: "58%", left: "6%", label: "Tổ chức y tế" },
  { icon: "👤", kind: "person", top: "74%", left: "36%", label: "Tình nguyện viên" },
  { icon: "🏫", kind: "org", top: "68%", left: "66%", label: "Tổ chức cộng đồng" },
  { icon: "👤", kind: "person", top: "14%", left: "70%", label: "Thành viên" },
] as const;

const networkDots = [
  { top: "40%", left: "2%", color: "bg-nghe" },
  { top: "4%", left: "38%", color: "bg-sky" },
  { top: "84%", left: "54%", color: "bg-lua" },
] as const;

const howSteps = [
  ["01", "Tìm chiến dịch đã xác thực", "Lọc theo hạng mục, khu vực hoặc loại đóng góp. Mọi tổ chức đều được xác minh giấy phép hoạt động."],
  ["02", "Ủng hộ qua VietQR động", "Scan mã QR sinh tự động — deep link kích hoạt thẳng app ngân hàng, tự điền sẵn TK, số tiền, nội dung."],
  ["03", "Theo dõi từng đồng đến tay người nhận", "Xem Cashflow Tree: tiền biến thành gạo, sách vở hay vật tư y tế gì — có hóa đơn VAT và ảnh GPS thực địa."],
] as const;

export default async function HomePage() {
  const [campaigns, personalCampaigns, homepageStats] = await Promise.all([
    getCampaigns(),
    getCampaigns("individual"),
    getHomepageStats(),
  ]);
  const [heroMain, ...heroRest] = campaigns;
  const heroSub = heroRest.slice(0, 2);
  const stats = [
    ["Tổ chức", homepageStats.verifiedOrganizationCount.toLocaleString("vi-VN"), "bg-sky"],
    ["Cá nhân", homepageStats.verifiedPersonalProfileCount.toLocaleString("vi-VN"), "bg-nghe"],
    ["Chiến dịch", homepageStats.publicCampaignCount.toLocaleString("vi-VN"), "bg-son"],
    ["Thành viên", homepageStats.memberCount.toLocaleString("vi-VN"), "bg-lua"],
    ["Lượt ủng hộ", homepageStats.completedDonationCount.toLocaleString("vi-VN"), "bg-nghe"],
    ["Số tiền (tỷ)", (homepageStats.totalReceivedVnd / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 }), "bg-sky"],
  ] as const;

  return (
    <main>
      <SiteHeader />

      {/* HERO GRID */}
      <section className="mx-auto grid max-w-[1160px] grid-cols-1 gap-4 px-7 pt-7 md:grid-cols-[1.6fr_1fr]">
        {heroMain ? (
          <Link href={`/campaigns/${encodeURIComponent(heroMain.slug)}`} className="group relative flex h-[420px] flex-col justify-end overflow-hidden rounded-[14px] bg-gradient-to-br from-[#5C3317] to-[#8B4513] p-7 text-white">
            {heroMain.coverUrl ? <div className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105" style={{ backgroundImage: `url("${heroMain.coverUrl}")` }} /> : null}
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
                {c.coverUrl ? <div className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105" style={{ backgroundImage: `url("${c.coverUrl}")` }} /> : null}
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
      <section className="mt-10 bg-paperMid">
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="flex flex-col items-center gap-7 py-[52px] lg:flex-row lg:gap-14">
            <div className="relative h-[260px] w-[260px] shrink-0 sm:h-[360px] sm:w-[360px]" aria-label="Mạng lưới cộng đồng thiện nguyện" role="img">
              <span className="absolute left-1/2 top-1/2 h-[108px] w-[108px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-line sm:h-[150px] sm:w-[150px]" />
              <span className="absolute left-1/2 top-1/2 h-[190px] w-[190px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-line sm:h-[264px] sm:w-[264px]" />
              <span className="absolute left-1/2 top-1/2 h-[256px] w-[256px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-line sm:h-[356px] sm:w-[356px]" />

              <span className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-son to-[#D4514A] text-[28px] text-white shadow-[0_0_0_11px_rgba(168,52,43,0.10),0_0_0_22px_rgba(168,52,43,0.05)] sm:h-[76px] sm:w-[76px] sm:text-[32px] sm:shadow-[0_0_0_14px_rgba(168,52,43,0.10),0_0_0_28px_rgba(168,52,43,0.05)]" aria-hidden="true">♥</span>

              {networkNodes.map((node) => (
                <span
                  key={`${node.label}-${node.top}-${node.left}`}
                  title={node.label}
                  className={`absolute z-20 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white text-sm shadow-card sm:h-[38px] sm:w-[38px] sm:text-[15px] ${node.kind === "org" ? "border-2 border-sky" : "border-2 border-nghe"}`}
                  style={{ top: node.top, left: node.left }}
                  aria-hidden="true"
                >
                  {node.icon}
                </span>
              ))}

              {networkDots.map((dot) => (
                <span key={`${dot.top}-${dot.left}`} className={`absolute h-2.5 w-2.5 rounded-full ${dot.color}`} style={{ top: dot.top, left: dot.left }} aria-hidden="true" />
              ))}
            </div>

            <div className="w-full flex-1">
              <h2 className="font-serif text-[27px] font-medium leading-[1.32] text-chamDeep sm:text-[30px]">
                Đồng hành cùng cộng đồng
                <br />
                thiện nguyện minh bạch từ năm 2021
              </h2>
              <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3">
                {stats.map(([label, value, dot]) => (
                  <div key={label}>
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-inkSoft">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                      {label}
                    </div>
                    <div className="font-mono text-[22px] font-bold leading-tight text-chamDeep">{value}</div>
                  </div>
                ))}
              </div>
              <p className="mt-7 text-xs text-inkSoft">Số liệu sẽ tự động cập nhật khi dữ liệu thống kê chính thức được đồng bộ.</p>
            </div>
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

      {/* PERSONAL CAMPAIGNS */}
      <section className="bg-paperMid py-14">
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Chiến dịch của Cá nhân</p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-chamDeep">Ai cũng có thể tạo chiến dịch</h2>
            </div>
            <Link href="/campaigns?owner=individual" className="text-sm font-bold text-son">Xem tất cả &rarr;</Link>
          </div>

          {personalCampaigns.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {personalCampaigns.map((campaign) => (
                <CampaignCard key={campaign.slug} campaign={campaign} />
              ))}
            </div>
          ) : (
            <div className="rounded-[14px] border border-dashed border-lineStrong bg-paper p-8 text-center">
              <div className="text-3xl" aria-hidden="true">👤</div>
              <p className="mt-3 font-serif text-lg font-semibold text-chamDeep">Chưa có chiến dịch cá nhân</p>
              <p className="mx-auto mt-1.5 max-w-2xl text-sm leading-6 text-inkMid">
                Chiến dịch cá nhân chỉ hiển thị sau khi chủ sở hữu được xác minh và Admin phê duyệt chiến dịch.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* HOW + 2 CAMPAIGN TYPES */}
      <section className="bg-paper py-14">
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="mb-3.5">
            <p className="eyebrow">2 loại hình chiến dịch</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-chamDeep">
              Dòng tiền minh bạch — Phù hợp mọi mục đích
            </h2>
          </div>

          <div className="mx-auto mb-9 grid max-w-[680px] gap-4 sm:grid-cols-2">
            <Link
              href="/campaigns?type=direct"
              className="rounded-[14px] border-2 border-son bg-sonMid p-[22px] transition duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-son"
            >
              <div className="mb-2.5 text-[28px] leading-none" aria-hidden="true">
                &#127974;
              </div>
              <h3 className="mb-1 text-[15px] font-bold text-chamDeep">Chiến dịch Trực tiếp</h3>
              <p className="text-[13px] leading-[1.6] text-inkMid">
                Quỹ tự triển khai. Hệ thống tự động tách 90/10 theo Nghị định 93/2021/NĐ-CP.
              </p>
              <div className="my-2.5 flex h-[7px] overflow-hidden rounded-full" aria-label="90% thực thi, 10% vận hành">
                <span className="w-[90%] bg-son" />
                <span className="w-[10%] bg-nghe" />
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="font-bold text-son">90% Thực thi</span>
                <span className="font-bold text-ngheDeep">10% Vận hành</span>
              </div>
            </Link>

            <Link
              href="/campaigns?type=partner"
              className="rounded-[14px] border-2 border-lineStrong bg-white p-[22px] transition duration-200 hover:-translate-y-0.5 hover:border-son hover:bg-sonMid hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-son"
            >
              <div className="mb-2.5 text-[28px] leading-none" aria-hidden="true">
                &#128279;
              </div>
              <h3 className="mb-1 text-[15px] font-bold text-chamDeep">Chiến dịch Kết nối</h3>
              <p className="text-[13px] leading-[1.6] text-inkMid">
                Tiếp nhận qua tài khoản trung tâm VEA, sau đó phân bổ cho đối tác theo hồ sơ được duyệt. Webhook xác nhận và xuất E-Receipt tự động.
              </p>
              <div className="mt-4 flex flex-col gap-1.5 text-[13px] text-lua">
                <span>&#10003; Đối soát tập trung theo từng giao dịch</span>
                <span>&#10003; E-Receipt tự động qua email</span>
              </div>
            </Link>
          </div>

          <div className="relative grid gap-8 sm:grid-cols-3 sm:gap-0">
            <div
              aria-hidden="true"
              className="absolute left-[calc(16.67%+14px)] right-[calc(16.67%+14px)] top-[30px] hidden h-0.5 bg-gradient-to-r from-son to-nghe sm:block"
            />
            {howSteps.map(([num, title, text]) => (
              <div key={num} className="relative z-10 px-2 text-center sm:px-5">
                <div className="mx-auto mb-3.5 flex h-[60px] w-[60px] items-center justify-center rounded-full border-[3px] border-son bg-white font-mono text-lg font-bold text-son">
                  {num}
                </div>
                <h4 className="mb-1.5 text-[14.5px] font-bold text-chamDeep">{title}</h4>
                <p className="text-[13px] leading-[1.65] text-inkMid">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
