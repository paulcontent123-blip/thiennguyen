"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const platformLinks = [
  ["Chiến dịch", "/campaigns"],
  ["Bản đồ SOS", "/sos"],
  ["Đóng góp nguồn lực", "/donate-items"],
  ["Báo cáo minh bạch", "/transparency"],
  ["Dashboard đóng cổng", "/transparency"],
] as const;

const organizationLinks = [
  ["Tài trợ công trình", "/corporate"],
  ["Matching Fund", "/corporate"],
  ["Liên hệ tư vấn", "/corporate"],
  ["Cổng quốc tế", "/corporate"],
  ["Tạo chiến dịch", "/organization"],
] as const;

const legalLinks = [
  ["Giới thiệu", "/introduction"],
  ["Điều khoản sử dụng", "/introduction#terms"],
  ["Chính sách bảo mật", "/introduction#privacy"],
  ["Nghị định 93/2021", "/introduction#decree-93"],
] as const;

function FooterColumn({ title, links }: { title: string; links: ReadonlyArray<readonly [string, string]> }) {
  return (
    <nav aria-label={title}>
      <h2 className="mb-[13px] text-[11px] font-bold uppercase tracking-[0.07em] text-white/40">{title}</h2>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={`${label}-${href}`}>
            <Link href={href} className="text-[13px] text-white/65 transition hover:text-white">{label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  const pathname = usePathname();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;

  return (
    <footer className="bg-chamDeep pb-[22px] pt-11 text-white">
      <div className="mx-auto max-w-[1160px] px-7">
        <div className="mb-8 grid grid-cols-1 gap-9 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 font-serif text-lg text-white transition hover:text-white/85">
              <span className="text-xl">♥</span>
              Thiện Nguyện
            </Link>
            <p className="mt-2.5 max-w-60 text-[13px] leading-[1.65] text-white/50">
              Nền tảng tiếp nhận và kết nối thiện nguyện minh bạch. Mỗi giao dịch được đối soát để có thể theo dấu từ đầu đến cuối.
            </p>
            <span className="mt-[13px] inline-flex items-center gap-1.5 rounded-[3px] bg-white/[0.06] px-3 py-1 font-mono text-[11px] text-white/45">
              <span className="h-1.5 w-1.5 rounded-full bg-lua" />
              Cam kết vĩnh viễn
            </span>
          </div>

          <FooterColumn title="Nền tảng" links={platformLinks} />
          <FooterColumn title="Doanh nghiệp" links={organizationLinks} />
          <FooterColumn title="Pháp lý" links={legalLinks} />
        </div>

        <div className="flex flex-col justify-between gap-2 border-t border-white/10 pt-4 text-xs text-white/35 sm:flex-row sm:items-center">
          <p>© 2026 thiennguyen.com.vn — Không thu phí · Không ràng buộc</p>
          <p>MVP · v2.1</p>
        </div>

        <div className="mt-[18px] border-t border-white/[0.07] py-[13px] text-xs leading-[1.75] text-white/35">
          <strong className="text-white/50">Tuyên bố miễn trừ trách nhiệm: </strong>
          Thiện Nguyện cung cấp công cụ tiếp nhận, đối soát và theo dõi dòng tiền. Khoản ủng hộ được nhận qua tài khoản trung tâm của đơn vị thành viên VEA Group, sau đó phân bổ theo hồ sơ chiến dịch và chứng từ đã duyệt. Dữ liệu cá nhân như số điện thoại và CCCD người thụ hưởng phải được che mờ theo Nghị định 13/2023/NĐ-CP.
        </div>
      </div>
    </footer>
  );
}
