import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getHomepageStats } from "@/lib/stats/homepage-stats";

const currency = new Intl.NumberFormat("vi-VN");

const principles = [
  {
    icon: "🔍",
    borderClass: "border-son",
    title: "Đối soát minh bạch từng giao dịch",
    body: "Mỗi lượt ủng hộ có mã giao dịch (tx_ref) riêng. Admin đối soát theo sao kê ngân hàng trước khi ghi nhận thành công — không tự động hoá khi chưa có webhook ngân hàng thật.",
  },
  {
    icon: "📊",
    borderClass: "border-nghe",
    title: "Dữ liệu công khai theo chiến dịch",
    body: "Số tiền đã ghi nhận, tiến độ giải ngân của từng chiến dịch hiển thị công khai — ai cũng xem được, không cần đăng nhập.",
  },
  {
    icon: "✅",
    borderClass: "border-lua",
    title: "Bằng chứng thực địa trước khi công khai",
    body: "Mọi khoản giải ngân phải kèm mô tả và tệp bằng chứng trước khi Admin hậu kiểm và ghi nhận vào Cashflow Tree.",
  },
] as const;

const legalBasis = [
  {
    icon: "📑",
    id: "decree-93",
    title: "Nghị định 93/2021/NĐ-CP",
    body: "Về vận động, tiếp nhận, phân phối và sử dụng các nguồn đóng góp tự nguyện. Cơ chế tách 90% thực thi / 10% vận hành cho chiến dịch Trực tiếp được xây dựng trên nền pháp lý này.",
  },
  {
    icon: "🔒",
    id: "privacy",
    title: "Nghị định 13/2023/NĐ-CP",
    body: "Bảo vệ dữ liệu cá nhân. Số điện thoại, CCCD người thụ hưởng phải được che mờ. Hệ thống không lưu giữ thông tin thẻ/tài khoản ngân hàng của nhà hảo tâm.",
  },
  {
    icon: "🛡️",
    id: "terms",
    title: "Kiểm soát truy cập ở tầng dữ liệu",
    body: "Mọi thao tác ghi/sửa dữ liệu (duyệt chiến dịch, xác nhận giao dịch, hậu kiểm giải ngân) đều qua Row-Level Security và guard trigger theo vai trò — không chỉ kiểm soát ở giao diện.",
  },
] as const;

export default async function IntroductionPage() {
  const stats = await getHomepageStats();

  const statCards = [
    ["VND đã ghi nhận", `${(stats.totalReceivedVnd / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu`, "text-son"],
    ["Chiến dịch công khai", currency.format(stats.publicCampaignCount), "text-chamDeep"],
    ["Thành viên", currency.format(stats.memberCount), "text-chamDeep"],
    ["Tổ chức đã xác minh", currency.format(stats.verifiedOrganizationCount), "text-chamDeep"],
    ["Phí nền tảng", "0%", "text-lua"],
  ] as const;

  return (
    <main>
      <SiteHeader />

      {/* HERO */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0D1B35] via-[#1B2E5A] to-[#0D2640] py-16 sm:py-20">
        <div className="pointer-events-none absolute -right-20 -top-16 h-96 w-96 rounded-full bg-son/10" />
        <div className="pointer-events-none absolute -left-10 bottom-[-40px] h-64 w-64 rounded-full bg-nghe/10" />
        <div className="relative mx-auto max-w-[1160px] px-7">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.08] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white/60">
              Giới thiệu tổ chức
            </span>
            <h1 className="mt-6 font-serif text-3xl font-medium leading-tight text-white sm:text-[42px]">
              Thiện Nguyện<br />
              <span className="text-nghe">nền tảng thiện nguyện minh bạch của VEA Group</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-white/70">
              Chúng tôi không phải là một tổ chức từ thiện. Chúng tôi là nền tảng công nghệ giúp tổ chức từ thiện vận hành minh bạch, và giúp nhà hảo tâm kiểm chứng đồng tiền của mình đi đâu.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/campaigns" className="button-primary">Xem các chiến dịch đang chạy</Link>
              <Link href="/transparency" className="rounded-[40px] border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
                Xem báo cáo minh bạch
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div className="border-b border-line bg-white py-6">
        <div className="mx-auto grid max-w-[1160px] grid-cols-2 gap-4 px-7 text-center sm:grid-cols-5 sm:gap-0">
          {statCards.map(([label, value, colorClass], index) => (
            <div key={label} className={`px-3 ${index > 0 ? "sm:border-l sm:border-line" : ""}`}>
              <div className={`font-serif text-2xl font-bold ${colorClass}`}>{value}</div>
              <div className="mt-1 text-xs text-inkSoft">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-[1160px] px-7 py-14">
        {/* SỨ MỆNH */}
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="eyebrow">Sứ mệnh</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-chamDeep sm:text-[28px]">Tại sao Thiện Nguyện ra đời?</h2>
            <p className="mt-4 leading-7 text-inkMid">
              Việt Nam có hàng chục nghìn chiến dịch từ thiện mỗi năm, nhưng người dùng không có công cụ để biết tiền đi đâu sau khi chuyển. Khủng hoảng niềm tin xảy ra không phải vì thiếu người tốt, mà vì thiếu công cụ minh bạch.
            </p>
            <p className="mt-3 leading-7 text-inkMid">
              Thiện Nguyện ra đời để làm một việc duy nhất: <strong className="text-chamDeep">biến mọi đồng tiền quyên góp thành dữ liệu công khai có thể kiểm chứng.</strong>
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {principles.map((item) => (
              <div key={item.title} className={`flex items-start gap-3 rounded-[8px] border-l-[3px] bg-paper p-4 ${item.borderClass}`}>
                <span className="shrink-0 text-xl">{item.icon}</span>
                <div>
                  <div className="text-sm font-bold text-chamDeep">{item.title}</div>
                  <div className="mt-1 text-sm leading-6 text-inkMid">{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PHÁP LÝ */}
        <div className="mt-16 rounded-[20px] bg-paper p-7 sm:p-9">
          <p className="eyebrow">Cơ sở pháp lý</p>
          <h3 className="mt-2 font-serif text-xl font-semibold text-chamDeep sm:text-2xl">Hoạt động tuân thủ quy định pháp luật Việt Nam</h3>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {legalBasis.map((item) => (
              <div key={item.title} id={item.id} className="scroll-mt-24 rounded-[8px] border border-line bg-white p-5">
                <div className="text-2xl">{item.icon}</div>
                <div className="mt-2.5 text-sm font-bold text-chamDeep">{item.title}</div>
                <div className="mt-1.5 text-xs leading-6 text-inkMid">{item.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CONTACT + MEDIA */}
        <div className="mt-16 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[14px] bg-chamDeep p-7 text-white">
            <div className="font-serif text-lg">Liên hệ hợp tác</div>
            <div className="mt-3 flex flex-col gap-2.5 text-sm text-white/75">
              <div>✉️ partner@thiennguyen.com.vn</div>
              <div>📍 Tòa nhà VEA Group</div>
              <div>🌐 thiennguyen.com.vn</div>
            </div>
            <Link href="/corporate" className="mt-5 inline-flex rounded-[40px] bg-son px-5 py-2.5 text-sm font-bold text-white transition hover:bg-son/90">
              Đăng ký đồng hành
            </Link>
          </div>
          <div className="rounded-[14px] border border-line bg-white p-7">
            <div className="font-serif text-lg text-chamDeep">Báo chí &amp; Truyền thông</div>
            <p className="mt-3 text-sm leading-7 text-inkMid">
              Nếu bạn là nhà báo, blogger hoặc content creator muốn viết về tính minh bạch trong thiện nguyện, chúng tôi sẵn sàng cung cấp dữ liệu và đầu mối liên hệ để kiểm chứng.
            </p>
            <a href="mailto:partner@thiennguyen.com.vn?subject=Y%C3%AAu%20c%E1%BA%A7u%20Media%20Kit" className="mt-2 inline-flex rounded-[8px] bg-chamDeep px-4 py-2.5 text-sm font-bold text-white transition hover:bg-chamDeep/90">
              Liên hệ để nhận Media Kit
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
