"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminPanelKey } from "@/lib/admin/panels";
import { createClient } from "@/lib/supabase/client";

const navItems: { key: AdminPanelKey; icon: string; label: string }[] = [
  { key: "overview", icon: "📊", label: "Tổng quan" },
  { key: "campaigns", icon: "🎯", label: "Duyệt chiến dịch" },
  { key: "kyc", icon: "📋", label: "Xác minh giấy phép" },
  { key: "personal", icon: "👤", label: "Xác minh cá nhân" },
  { key: "payments", icon: "🏦", label: "Tài khoản nhận tiền" },
  { key: "donations", icon: "🧾", label: "Đối soát quyên góp" },
  { key: "corporate", icon: "🤝", label: "Yêu cầu doanh nghiệp" },
  { key: "disbursement", icon: "💰", label: "Hậu kiểm giải ngân" },
  { key: "sos", icon: "📍", label: "SOS Reports" },
];

type AdminSidebarProps = {
  active: AdminPanelKey;
  labels?: Partial<Record<AdminPanelKey, string>>;
  // Có onSelect: chuyển panel trong Admin Portal. Không có: điều hướng về /admin?panel=… (dùng ở các trang con như /admin/sos).
  onSelect?: (key: AdminPanelKey) => void;
};

export function AdminSidebar({ active, labels, onSelect }: AdminSidebarProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoggingOut(false);
      setLogoutError("Không thể đăng xuất. Vui lòng thử lại.");
      return;
    }

    router.replace("/");
    router.refresh();
  }

  const itemClass = (key: AdminPanelKey) =>
    `flex shrink-0 items-center gap-2.5 border-l-[3px] px-3 py-2.5 text-left text-[13px] transition lg:px-5 ${active === key ? "border-l-son bg-white/10 font-bold text-white" : "border-l-transparent text-white/65 hover:bg-white/[0.06] hover:text-white"}`;

  return (
    <aside className="flex flex-col bg-chamDeep px-3 py-5 text-white lg:min-h-screen lg:px-0 lg:py-6">
      <div className="border-b border-white/10 px-2 pb-4 lg:px-5"><div className="text-sm text-white/65">Thiện Nguyện</div><strong className="font-serif text-[17px]">Admin Portal</strong></div>
      <nav className="flex gap-1 overflow-x-auto pt-3 lg:flex-col lg:gap-0 lg:px-0">
        {navItems.map((item) => {
          const content = <><span className="w-[18px] text-center">{item.icon}</span>{labels?.[item.key] ?? item.label}</>;
          return onSelect ? (
            <button key={item.key} type="button" onClick={() => onSelect(item.key)} className={itemClass(item.key)}>{content}</button>
          ) : (
            <Link key={item.key} href={item.key === "overview" ? "/admin" : `/admin?panel=${item.key}`} className={itemClass(item.key)}>{content}</Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-white/10 pt-3 lg:mt-auto lg:px-3 lg:pt-4">
        <Link href="/" className="flex items-center gap-2.5 px-2 py-2.5 text-[13px] text-white/65 transition hover:text-white"><span className="w-[18px] text-center">←</span>Về trang chủ</Link>
        <button type="button" onClick={handleLogout} disabled={loggingOut} className="flex w-full items-center gap-2.5 rounded-[4px] px-2 py-2.5 text-left text-[13px] font-bold text-white/75 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60">
          <span className="w-[18px] text-center">↪</span>{loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
        </button>
        {logoutError ? <p className="px-2 pt-1 text-xs text-red-300">{logoutError}</p> : null}
      </div>
    </aside>
  );
}
