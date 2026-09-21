"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { allowedRolesForPath } from "@/lib/auth/permissions";
import { isAppRole, isPublicRegistrationRole } from "@/lib/auth/roles";

type Tab = "login" | "register";

type AuthControlsProps = {
  isAuthenticated?: boolean;
  email?: string;
  username?: string;
  roleLabel?: string;
};

export function AuthControls({ isAuthenticated = false, email, username = "Tài khoản", roleLabel }: AuthControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Modal được render qua Portal thẳng vào document.body (xem cuối file) —
  // vì header cha có backdrop-blur (CSS backdrop-filter), nếu render modal
  // là con cháu của header thì "fixed inset-0" sẽ bị tính theo khung header
  // thay vì viewport (backdrop-filter tạo containing block mới cho descendant fixed).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountMenuError, setAccountMenuError] = useState<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountMenuOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  // /login và /register vẫn là URL thật (middleware redirect tới /login?next=... khi chặn route),
  // nên khi vào đúng 2 đường dẫn này thì tự mở modal ở đúng tab tương ứng.
  useEffect(() => {
    if (pathname === "/login") {
      setTab("login");
      setOpen(true);
    } else if (pathname === "/register") {
      setTab("register");
      setOpen(true);
    }
  }, [pathname]);

  function openModal(nextTab: Tab) {
    setError(null);
    setNotice(null);
    setTab(nextTab);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setError(null);
    setNotice(null);
  }

  async function handleLogin(formData: FormData) {
    setLoading(true);
    setError(null);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const supabase = createClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setLoading(false);
      setError("Email hoặc mật khẩu không đúng");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", signInData.user.id)
      .maybeSingle();

    const role = isAppRole(profile?.role) ? profile.role : null;
    if (profileError || !role) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Đăng nhập thành công nhưng không thể xác định quyền tài khoản.");
      return;
    }

    const next = searchParams.get("next");
    const isSafeInternalPath = Boolean(next?.startsWith("/") && !next.startsWith("//"));
    const nextRoles = next && isSafeInternalPath ? allowedRolesForPath(next) : null;

    let destination = "/account";
    if (role === "admin") {
      destination = "/admin";
    } else if (next && isSafeInternalPath && (!nextRoles || (role && nextRoles.includes(role)))) {
      destination = next;
    }

    setLoading(false);
    closeModal();
    router.push(destination);
    router.refresh();
  }

  async function handleRegister(formData: FormData) {
    setLoading(true);
    setError(null);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const accountType = formData.get("accountType");

    if (!isPublicRegistrationRole(accountType)) {
      setLoading(false);
      setError("Loại tài khoản không hợp lệ");
      return;
    }

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, account_type: accountType } },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      closeModal();
      router.refresh();
      router.push("/account");
      return;
    }

    setNotice("Đã tạo tài khoản! Kiểm tra email để xác nhận trước khi đăng nhập.");
    setTab("login");
  }

  async function handleLogout() {
    setLoading(true);
    setAccountMenuError(null);
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut();
    setLoading(false);
    if (signOutError) {
      setAccountMenuError("Không thể đăng xuất. Vui lòng thử lại.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (isAuthenticated) {
    return (
      <div ref={accountMenuRef} className="relative">
        <button
          type="button"
          title={email}
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          onClick={() => {
            setAccountMenuError(null);
            setAccountMenuOpen((current) => !current);
          }}
          className="flex max-w-[220px] items-center gap-2 rounded-[40px] border border-lineStrong py-1.5 pl-1.5 pr-3 text-left transition hover:border-son"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-chamDeep text-sm font-bold uppercase text-white">
            {username.trim().charAt(0) || "U"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-bold text-chamDeep">{username}</span>
            {roleLabel ? <span className="block truncate text-[11px] text-inkSoft">{roleLabel}</span> : null}
          </span>
          <span className={`ml-1 text-[10px] text-inkSoft transition ${accountMenuOpen ? "rotate-180" : ""}`}>▼</span>
        </button>

        {accountMenuOpen ? (
          <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-[10px] border border-line bg-white py-1.5 shadow-modal">
            <div className="border-b border-line px-4 py-2.5">
              <p className="truncate text-xs font-bold text-chamDeep">{username}</p>
              <p className="mt-0.5 truncate text-[11px] text-inkSoft">{email}</p>
              {accountMenuError ? <p className="mt-2 text-[11px] text-son">{accountMenuError}</p> : null}
            </div>
            <Link
              href="/account"
              role="menuitem"
              onClick={() => setAccountMenuOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-inkMid transition hover:bg-paper hover:text-son"
            >
              <span aria-hidden>👤</span> Tài khoản
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={loading}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-son transition hover:bg-son/5 disabled:cursor-wait disabled:opacity-60"
            >
              <span aria-hidden>↪</span> {loading ? "Đang đăng xuất…" : "Đăng xuất"}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => openModal("login")}
        className="rounded-[40px] border border-lineStrong px-4 py-2 text-[13px] font-bold text-chamDeep transition hover:border-son hover:text-son"
      >
        Đăng nhập
      </button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeModal();
              }}
        >
          <div className="relative w-full max-w-md rounded-[14px] bg-white p-7 shadow-modal">
            <button
              type="button"
              onClick={closeModal}
              aria-label="Đóng"
              className="absolute right-5 top-5 text-xl text-inkSoft transition hover:text-son"
            >
              &#215;
            </button>

            <div className="mb-5 flex gap-6 border-b border-line">
              <button
                type="button"
                onClick={() => openModal("login")}
                className={`-mb-px border-b-2 pb-3 text-sm font-bold transition ${
                  tab === "login" ? "border-son text-son" : "border-transparent text-inkSoft hover:text-inkMid"
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => openModal("register")}
                className={`-mb-px border-b-2 pb-3 text-sm font-bold transition ${
                  tab === "register" ? "border-son text-son" : "border-transparent text-inkSoft hover:text-inkMid"
                }`}
              >
                Tạo tài khoản
              </button>
            </div>

            {notice ? <p className="mb-4 rounded-[8px] bg-lua/10 p-3 text-sm text-lua">{notice}</p> : null}
            {error ? <p className="mb-4 rounded-[8px] bg-son/10 p-3 text-sm text-son">{error}</p> : null}

            {tab === "login" ? (
              <>
                <h2 className="font-serif text-xl font-semibold text-chamDeep">Chào mừng trở lại</h2>
                <p className="mt-1 text-sm text-inkMid">Đăng nhập để xem lịch sử và theo dõi tiến trình.</p>
                <form action={handleLogin} className="mt-5 space-y-4">
                  <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                    Email
                    <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="email" type="email" required />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                    Mật khẩu
                    <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="password" type="password" required />
                  </label>
                  <button className="button-primary w-full" type="submit" disabled={loading}>
                    {loading ? "Đang đăng nhập…" : "Đăng nhập →"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="font-serif text-xl font-semibold text-chamDeep">Tạo tài khoản miễn phí</h2>
                <p className="mt-1 text-sm text-inkMid">Cá nhân hoặc Doanh nghiệp/Tổ chức — cùng một nơi đăng ký.</p>
                <form action={handleRegister} className="mt-5 space-y-4">
                  <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                    Họ và tên
                    <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="fullName" required />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                    Email
                    <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="email" type="email" required />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                    Mật khẩu
                    <input
                      className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal"
                      name="password"
                      type="password"
                      minLength={8}
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                    Loại tài khoản
                    <select className="rounded-[8px] border border-line bg-white px-4 py-3 text-sm font-normal" name="accountType">
                      <option value="donor">Cá nhân</option>
                      <option value="org">Doanh nghiệp / Tổ chức</option>
                    </select>
                  </label>
                  <p className="rounded-[8px] bg-paper p-3 text-xs leading-5 text-inkMid">
                    Người đăng ký tài khoản tổ chức được xem là người đại diện pháp luật và phải upload giấy phép hoạt động trước khi tạo
                    campaign.
                  </p>
                  <button className="button-primary w-full" type="submit" disabled={loading}>
                    {loading ? "Đang tạo…" : "Tạo tài khoản →"}
                  </button>
                </form>
              </>
            )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
