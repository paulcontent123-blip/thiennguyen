"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isPublicRegistrationRole } from "@/lib/auth/roles";

type Tab = "login" | "register";

export function AuthControls() {
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
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError("Email hoặc mật khẩu không đúng");
      return;
    }

    const next = searchParams.get("next");
    closeModal();
    router.refresh();
    router.push(next && next.startsWith("/") ? next : "/account");
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
