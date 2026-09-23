"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSafeInternalPath, resolveAuthenticatedDestination } from "@/lib/auth/destination";
import { isAppRole, isPublicRegistrationRole } from "@/lib/auth/roles";

// Google chưa bật được trên Supabase (cần gắn thẻ thanh toán Google Cloud) — xem docs/HuongDan_DangNhap_Google.md
const GOOGLE_LOGIN_ENABLED = false;

type AuthView = "login" | "register" | "emailOtp" | "forgotPassword";

type AuthControlsProps = {
  isAuthenticated?: boolean;
  email?: string;
  username?: string;
  roleLabel?: string;
  roleLinks?: readonly (readonly string[])[];
};

export function AuthControls({ isAuthenticated = false, email, username = "Tài khoản", roleLabel, roleLinks = [] }: AuthControlsProps) {
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
  const [view, setView] = useState<AuthView>("login");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
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
      setView("login");
      setOpen(true);
    } else if (pathname === "/register") {
      setView("register");
      setOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    const authError = searchParams.get("error");
    const authNotice = searchParams.get("notice");
    if (pathname !== "/login" || (!authError && !authNotice)) return;

    if (authError) setError(authError);
    if (authNotice === "password-reset-success") setNotice("Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.");
  }, [pathname, searchParams]);

  function openModal(nextView: AuthView) {
    setError(null);
    setNotice(null);
    setView(nextView);
    if (nextView !== "emailOtp") setOtpSent(false);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setError(null);
    setNotice(null);
  }

  function requestedDestination() {
    const next = searchParams.get("next");
    return isSafeInternalPath(next) ? next : "/account";
  }

  async function finishLogin(userId: string) {
    const supabase = createClient();
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    const role = isAppRole(profile?.role) ? profile.role : null;

    if (profileError || !role) {
      await supabase.auth.signOut();
      setError("Đăng nhập thành công nhưng không thể xác định quyền tài khoản.");
      return false;
    }

    const destination = resolveAuthenticatedDestination(role, requestedDestination());
    closeModal();
    router.push(destination);
    router.refresh();
    return true;
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

    await finishLogin(signInData.user.id);
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", requestedDestination());

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });

    if (oauthError) {
      setLoading(false);
      setError("Không thể chuyển đến Google. Vui lòng kiểm tra cấu hình OAuth.");
    }
  }

  async function handleSendEmailOtp(formData: FormData) {
    setLoading(true);
    setError(null);
    setNotice(null);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);

    if (otpError) {
      setError("Không thể gửi mã đăng nhập. Kiểm tra email hoặc thử lại sau.");
      return;
    }

    setOtpEmail(email);
    setOtpSent(true);
    setNotice("Nếu email đã đăng ký, mã OTP 6 số đã được gửi. Mã có thời hạn theo cấu hình Supabase Auth.");
  }

  async function handleVerifyEmailOtp(formData: FormData) {
    setLoading(true);
    setError(null);
    const token = String(formData.get("token") ?? "").replace(/\s/g, "");
    const supabase = createClient();
    const { data, error: otpError } = await supabase.auth.verifyOtp({ email: otpEmail, token, type: "email" });

    if (otpError || !data.user) {
      setLoading(false);
      setError("Mã OTP không đúng hoặc đã hết hạn.");
      return;
    }

    await finishLogin(data.user.id);
    setLoading(false);
  }

  async function handleForgotPassword(formData: FormData) {
    setLoading(true);
    setError(null);
    setNotice(null);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", "/reset-password");
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
    setLoading(false);

    if (resetError) {
      setError("Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.");
      return;
    }

    setNotice("Nếu tài khoản tồn tại, hệ thống đã gửi liên kết đặt lại mật khẩu đến email trên.");
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
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", "/account");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, account_type: accountType },
        emailRedirectTo: callback.toString(),
      },
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
    setView("login");
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
            {roleLinks.length > 0 ? (
              <div role="none" className="border-t border-line py-1.5">
                {roleLinks.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-son transition hover:bg-son/5"
                  >
                    <span aria-hidden>⚙</span> {label}
                  </Link>
                ))}
              </div>
            ) : null}
            <div role="none" className="border-t border-line py-1.5">
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
                  view !== "register" ? "border-son text-son" : "border-transparent text-inkSoft hover:text-inkMid"
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => openModal("register")}
                className={`-mb-px border-b-2 pb-3 text-sm font-bold transition ${
                  view === "register" ? "border-son text-son" : "border-transparent text-inkSoft hover:text-inkMid"
                }`}
              >
                Tạo tài khoản
              </button>
            </div>

            {notice ? <p className="mb-4 rounded-[8px] bg-lua/10 p-3 text-sm text-lua">{notice}</p> : null}
            {error ? <p className="mb-4 rounded-[8px] bg-son/10 p-3 text-sm text-son">{error}</p> : null}

            {view === "login" ? (
              <>
                <h2 className="font-serif text-xl font-semibold text-chamDeep">Chào mừng trở lại</h2>
                <p className="mt-1 text-sm text-inkMid">Đăng nhập để xem lịch sử và theo dõi tiến trình.</p>
                {GOOGLE_LOGIN_ENABLED ? (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="mt-5 flex w-full items-center justify-center gap-3 rounded-[40px] border border-lineStrong px-5 py-3 text-sm font-bold text-chamDeep transition hover:border-sky hover:text-sky disabled:cursor-wait disabled:opacity-60"
                    >
                      <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-white font-sans text-base font-bold text-[#4285f4]">G</span>
                      Tiếp tục với Google
                    </button>
                    <div className="my-4 flex items-center gap-3 text-xs text-inkSoft"><span className="h-px flex-1 bg-line" /><span>hoặc</span><span className="h-px flex-1 bg-line" /></div>
                  </>
                ) : null}
                <form action={handleLogin} className="mt-5 space-y-4">
                  <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                    Email
                    <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="email" type="email" required />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                    <span className="flex items-center justify-between gap-3">
                      Mật khẩu
                      <button type="button" onClick={() => openModal("forgotPassword")} className="text-xs font-bold text-son hover:underline">
                        Quên mật khẩu?
                      </button>
                    </span>
                    <input className="rounded-[8px] border border-line px-4 py-3 text-sm font-normal" name="password" type="password" required />
                  </label>
                  <button className="button-primary w-full" type="submit" disabled={loading}>
                    {loading ? "Đang đăng nhập…" : "Đăng nhập →"}
                  </button>
                </form>
                <button type="button" onClick={() => openModal("emailOtp")} className="mt-4 w-full text-center text-sm font-bold text-sky hover:underline">
                  Đăng nhập bằng mã OTP qua email
                </button>
              </>
            ) : null}

            {view === "emailOtp" ? (
              <>
                <h2 className="font-serif text-xl font-semibold text-chamDeep">Đăng nhập bằng email OTP</h2>
                <p className="mt-1 text-sm leading-6 text-inkMid">Hệ thống gửi mã 6 số qua email. Không sử dụng OTP số điện thoại.</p>
                {!otpSent ? (
                  <form action={handleSendEmailOtp} className="mt-5 space-y-4">
                    <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                      Email đã đăng ký
                      <input className="rounded-[8px] border border-line px-4 py-3 font-normal" name="email" type="email" autoComplete="email" required />
                    </label>
                    <button className="button-primary w-full" type="submit" disabled={loading}>{loading ? "Đang gửi…" : "Gửi mã OTP"}</button>
                  </form>
                ) : (
                  <form action={handleVerifyEmailOtp} className="mt-5 space-y-4">
                    <p className="rounded-[8px] bg-paper p-3 text-xs text-inkMid">Mã được gửi tới <strong>{otpEmail}</strong>.</p>
                    <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                      Mã OTP 6 số
                      <input className="rounded-[8px] border border-line px-4 py-3 text-center font-mono text-xl tracking-[0.3em]" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
                    </label>
                    <button className="button-primary w-full" type="submit" disabled={loading}>{loading ? "Đang xác minh…" : "Xác minh và đăng nhập"}</button>
                    <button type="button" onClick={() => { setOtpSent(false); setNotice(null); setError(null); }} className="w-full text-sm font-bold text-sky hover:underline">Dùng email khác hoặc gửi lại mã</button>
                  </form>
                )}
                <button type="button" onClick={() => openModal("login")} className="mt-4 w-full text-sm font-bold text-inkMid hover:text-son">← Đăng nhập bằng mật khẩu</button>
              </>
            ) : null}

            {view === "forgotPassword" ? (
              <>
                <h2 className="font-serif text-xl font-semibold text-chamDeep">Quên mật khẩu</h2>
                <p className="mt-1 text-sm leading-6 text-inkMid">Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.</p>
                <form action={handleForgotPassword} className="mt-5 space-y-4">
                  <label className="grid gap-1 text-sm font-semibold text-chamDeep">
                    Email
                    <input className="rounded-[8px] border border-line px-4 py-3 font-normal" name="email" type="email" autoComplete="email" required />
                  </label>
                  <button className="button-primary w-full" type="submit" disabled={loading}>{loading ? "Đang gửi…" : "Gửi liên kết đặt lại mật khẩu"}</button>
                </form>
                <button type="button" onClick={() => openModal("login")} className="mt-4 w-full text-sm font-bold text-inkMid hover:text-son">← Quay lại đăng nhập</button>
              </>
            ) : null}

            {view === "register" ? (
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
            ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
