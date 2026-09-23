import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { CorporateInquiryModal } from "@/components/corporate/corporate-inquiry-modal";
import { MatchingFundCalculator } from "@/components/corporate/matching-fund-calculator";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const currency = new Intl.NumberFormat("vi-VN");

type SponsorProject = { id: string; slug: string; title: string; province: string | null; targetAmount: number; receivedAmount: number; percent: number };

async function getSponsorProjects(): Promise<SponsorProject[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, slug, title, province, target_amount")
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(12);
  if (error || !data) return [];

  const projects = await Promise.all(data.map(async (row) => {
    const { data: summary } = await supabase.rpc("get_campaign_donation_summary", { p_campaign_id: row.id });
    const summaryRow = Array.isArray(summary) ? summary[0] : summary;
    const receivedAmount = Number(summaryRow?.total_amount_vnd ?? 0);
    const targetAmount = Number(row.target_amount);
    const percent = targetAmount > 0 ? Math.min(100, Math.round((receivedAmount / targetAmount) * 100)) : 0;
    return { id: row.id, slug: row.slug, title: row.title, province: row.province, targetAmount, receivedAmount, percent };
  }));

  return projects.sort((a, b) => a.percent - b.percent).slice(0, 3);
}

const formats = [
  { anchor: "corp-m1", icon: "🏫", title: "Tài trợ Công trình Trọn gói", subtitle: "Co-Branded Impact" },
  { anchor: "corp-m2", icon: "📈", title: "Gây quỹ Đối ứng", subtitle: "Matching Fund X2/X3" },
  { anchor: "corp-m3", icon: "📦", title: "Nguồn lực Phi tiền tệ", subtitle: "Hiện vật, ngày công, xe" },
  { anchor: "corp-m4", icon: "📋", title: "Ủy thác & Số hóa ESG", subtitle: "Sắp ra mắt" },
] as const;

const nonMonetaryTypes = [
  { icon: "💊", title: "Hiện vật", body: "Sản phẩm/thiết bị của doanh nghiệp (thuốc, kit y tế, nhu yếu phẩm…) phù hợp với nhu cầu chiến dịch." },
  { icon: "🚚", title: "Ngày công & phương tiện", body: "Xe vận chuyển, nhân sự chuyên môn (bác sĩ, kỹ sư…) tham gia trực tiếp các đợt bàn giao." },
  { icon: "🎓", title: "Tri thức & đào tạo", body: "Chương trình tập huấn, chuyển giao kỹ năng cho cộng đồng thụ hưởng." },
] as const;

export default async function CorporatePage() {
  const projects = await getSponsorProjects();

  return (
    <main>
      <SiteHeader />

      {/* HERO */}
      <div className="bg-gradient-to-br from-[#0D1B35] via-[#1B3A6B] to-[#0D2A4A] py-14 sm:py-16">
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-white/65">
              Dành riêng cho Doanh nghiệp &amp; Tổ chức
            </span>
            <h1 className="mt-5 font-serif text-[28px] font-medium leading-tight text-white sm:text-4xl">
              Đồng hành cùng quỹ<br />
              <span className="text-nghe">tạo tác động thực sự</span>
            </h1>
            <p className="mt-3.5 max-w-xl text-[15px] leading-7 text-white/65">
              Không phải &ldquo;mua gói CSR&rdquo;. Đây là nền tảng để doanh nghiệp đồng hành trực tiếp vào các chiến dịch có địa chỉ thực — theo dõi tiến độ giải ngân công khai, có bằng chứng thực địa cho từng khoản chi.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <CorporateInquiryModal
                triggerClassName="rounded-[40px] bg-son px-6 py-3 text-sm font-bold text-white transition hover:bg-son/90"
                triggerLabel="Đăng ký đồng hành →"
              />
              <CorporateInquiryModal
                triggerClassName="rounded-[40px] border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                triggerLabel="Yêu cầu tài liệu giới thiệu"
              />
            </div>
          </div>
        </div>
      </div>

      {/* QUICK NAV */}
      <section className="border-b border-line bg-white py-7">
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {formats.map((item) => (
              <a
                key={item.anchor}
                href={`#${item.anchor}`}
                className="flex items-start gap-3 rounded-[8px] border border-line bg-paper p-4 transition hover:border-son hover:bg-sonSoft"
              >
                <span className="shrink-0 text-xl">{item.icon}</span>
                <div>
                  <div className="text-sm font-bold text-chamDeep">{item.title}</div>
                  <div className="mt-0.5 text-xs text-inkSoft">{item.subtitle}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-7 py-14">
        <div className="mb-10 text-center">
          <p className="eyebrow">4 hình thức đồng hành</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-chamDeep sm:text-[28px]">
            Chọn phương thức phù hợp nhất với định hướng của doanh nghiệp
          </h2>
        </div>

        {/* MỤC 1 */}
        <div id="corp-m1" className="scroll-mt-24 grid gap-8 pb-14 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex rounded-full bg-sonSoft px-3.5 py-1 text-xs font-bold text-son">Mục 1</span>
            <h3 className="mt-3.5 font-serif text-xl font-medium text-chamDeep sm:text-2xl">
              Tài trợ Công trình Trọn gói<br />
              <span className="text-lg text-son sm:text-xl">(Co-Branded Impact)</span>
            </h3>
            <p className="mt-3 text-sm leading-7 text-inkMid">
              Doanh nghiệp đồng hành toàn phần một chiến dịch có địa chỉ thực (trường học, nhà ở, y tế, cứu trợ khẩn cấp). Tiến độ giải ngân và bằng chứng thực địa được công khai trên trang chiến dịch.
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm text-ink">
              <li className="flex gap-2"><span className="font-bold text-lua">✓</span> Theo dõi công khai số tiền đã ghi nhận và tiến độ giải ngân</li>
              <li className="flex gap-2"><span className="font-bold text-lua">✓</span> Mỗi khoản giải ngân kèm mô tả và tệp bằng chứng đã được Admin hậu kiểm</li>
              <li className="flex gap-2"><span className="font-bold text-lua">✓</span> Trang chiến dịch riêng để giới thiệu sự đồng hành của doanh nghiệp</li>
            </ul>
            <Link href="/campaigns" className="mt-5 inline-flex rounded-[40px] bg-chamDeep px-5 py-2.5 text-sm font-bold text-white transition hover:bg-chamDeep/90">
              Xem các chiến dịch đang cần tài trợ →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {projects.length === 0 ? (
              <div className="rounded-[14px] border-2 border-dashed border-lineStrong bg-paperMid p-8 text-center text-sm leading-6 text-inkMid">
                Chưa có chiến dịch nào đang hoạt động. Hãy để lại yêu cầu, đội ngũ sẽ đề xuất công trình phù hợp.
              </div>
            ) : (
              projects.map((project) => (
                <div key={project.id} className="flex items-start gap-3 rounded-[8px] border border-line bg-white p-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/campaigns/${encodeURIComponent(project.slug)}`} className="text-sm font-bold text-chamDeep hover:text-son">
                      {project.title}
                    </Link>
                    <div className="mt-0.5 text-xs text-inkSoft">{project.province ? `📍 ${project.province}` : "Toàn quốc"}</div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-paperDeep">
                      <div className="h-full rounded-full bg-son" style={{ width: `${project.percent}%` }} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs">
                      <span className="font-mono font-bold text-son">Mục tiêu {currency.format(project.targetAmount)}đ</span>
                      <span className={project.percent === 0 ? "text-son" : "text-ngheDeep"}>
                        {project.percent === 0 ? "Cần nhà tài trợ" : `${project.percent}% đã ghi nhận`}
                      </span>
                    </div>
                  </div>
                  <CorporateInquiryModal
                    interest="co_branded"
                    campaign={{ id: project.id, title: project.title }}
                    triggerClassName="shrink-0 rounded-[4px] bg-son px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-son/90"
                    triggerLabel="Đăng ký"
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* MỤC 2 */}
        <div id="corp-m2" className="scroll-mt-24 rounded-[20px] bg-paper p-6 sm:p-9">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex rounded-full bg-nghe/15 px-3.5 py-1 text-xs font-bold text-ngheDeep">Mục 2</span>
              <h3 className="mt-3.5 font-serif text-xl font-medium text-chamDeep sm:text-2xl">
                Chương trình Gây quỹ Đối ứng<br />
                <span className="text-lg text-ngheDeep sm:text-xl">(Matching Fund)</span>
              </h3>
              <p className="mt-3 text-sm leading-7 text-inkMid">
                Doanh nghiệp cam kết đối ứng số tiền tương đương số tiền cộng đồng/nhân viên quyên góp cho một chiến dịch, theo hệ số thoả thuận (X1/X2/X3).
              </p>
              <ul className="mt-4 flex flex-col gap-2 text-sm text-ink">
                <li className="flex gap-2"><span className="font-bold text-lua">✓</span> Nhân viên quyên 100.000đ → doanh nghiệp đối ứng thêm theo hệ số đã thoả thuận</li>
                <li className="flex gap-2"><span className="font-bold text-lua">✓</span> Theo dõi tổng số tiền đã ghi nhận trên trang chiến dịch công khai</li>
              </ul>
              <div className="mt-5">
                <CorporateInquiryModal
                  interest="matching_fund"
                  triggerClassName="inline-flex rounded-[40px] bg-nghe px-5 py-2.5 text-sm font-bold text-white transition hover:bg-nghe/90"
                  triggerLabel="Yêu cầu kết nối nguồn lực →"
                />
              </div>
            </div>
            <MatchingFundCalculator />
          </div>
        </div>

        {/* MỤC 3 */}
        <div id="corp-m3" className="scroll-mt-24 grid gap-8 py-14 lg:grid-cols-2 lg:items-start">
          <div>
            <span className="inline-flex rounded-full bg-skySoft px-3.5 py-1 text-xs font-bold text-sky">Mục 3</span>
            <h3 className="mt-3.5 font-serif text-xl font-medium text-chamDeep sm:text-2xl">
              Đóng góp Nguồn lực Phi tiền tệ<br />
              <span className="text-lg text-sky sm:text-xl">(Non-monetary Support)</span>
            </h3>
            <p className="mt-3 text-sm leading-7 text-inkMid">
              Không chỉ dừng ở tiền mặt — doanh nghiệp có thể đồng hành bằng hiện vật, phương tiện, hoặc ngày công chuyên môn phù hợp với nhu cầu thực tế của từng chiến dịch.
            </p>
            <div className="mt-5">
              <CorporateInquiryModal
                interest="in_kind"
                triggerClassName="inline-flex rounded-[40px] bg-sky px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky/90"
                triggerLabel="Kết nối nguồn lực →"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {nonMonetaryTypes.map((item) => (
              <div key={item.title} className="flex items-center gap-3.5 rounded-[8px] border border-line bg-white p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-skySoft text-xl">{item.icon}</div>
                <div>
                  <div className="text-sm font-bold text-chamDeep">{item.title}</div>
                  <div className="mt-0.5 text-xs leading-5 text-inkSoft">{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MỤC 4 */}
        <div id="corp-m4" className="scroll-mt-24 rounded-[20px] bg-gradient-to-br from-[#0F2044] to-[#1B3A6B] p-7 sm:p-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold text-white/65">
            Mục 4 · Sắp ra mắt
          </span>
          <h3 className="mt-3.5 font-serif text-xl font-medium text-white sm:text-2xl">
            Ủy thác &amp; Số hóa Hồ sơ ESG<br />
            <span className="text-lg text-nghe sm:text-xl">(Annual ESG Hub)</span>
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">
            Định hướng phát triển: tự động gom chứng từ số (hóa đơn, ảnh bằng chứng thực địa, biên bản nghiệm thu) thành báo cáo tác động hàng năm cho doanh nghiệp — hiện chưa triển khai. Nếu doanh nghiệp quan tâm, để lại yêu cầu để chúng tôi ưu tiên xây dựng theo nhu cầu thực tế.
          </p>
          <div className="mt-6">
            <CorporateInquiryModal
              interest="esg_hub"
              triggerClassName="inline-flex rounded-[40px] bg-nghe px-5 py-2.5 text-sm font-bold text-white transition hover:bg-nghe/90"
              triggerLabel="Đăng ký quan tâm →"
            />
          </div>
        </div>

        {/* CO-MONITORING CTA */}
        <div className="mt-14 flex flex-wrap items-center justify-between gap-5 rounded-[14px] border border-line bg-paper p-7">
          <div>
            <div className="font-serif text-lg text-chamDeep">👥 Cử nhân sự đồng hành thực địa</div>
            <p className="mt-1.5 max-w-lg text-sm text-inkMid">
              Doanh nghiệp có thể cử nhân viên trực tiếp tham gia các đợt bàn giao cùng chiến dịch đã đồng hành.
            </p>
          </div>
          <CorporateInquiryModal interest="field_staff" triggerClassName="button-primary" triggerLabel="Đăng ký cử nhân sự →" />
        </div>
      </section>
    </main>
  );
}
