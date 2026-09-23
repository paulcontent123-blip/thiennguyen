"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setAuthorized(Boolean(data.user));
      setChecking(false);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");

    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn.");
      return;
    }

    setNotice("Đã đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.");
    await supabase.auth.signOut();
    window.setTimeout(() => {
      router.replace("/login?notice=password-reset-success");
      router.refresh();
    }, 1200);
  }

  return (
    <div className="rounded-[14px] border border-line bg-white p-7 shadow-card">
      <p className="eyebrow">Bảo mật tài khoản</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-chamDeep">Đặt lại mật khẩu</h1>

      {checking ? <p className="mt-5 text-sm text-inkSoft">Đang kiểm tra liên kết…</p> : null}
      {!checking && !authorized ? (
        <div className="mt-5 rounded-[8px] bg-nghe/10 p-4 text-sm leading-6 text-ngheDeep">
          Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy quay lại màn hình đăng nhập và yêu cầu email mới.
        </div>
      ) : null}

      {authorized ? (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error ? <p className="rounded-[8px] bg-son/10 p-3 text-sm text-son">{error}</p> : null}
          {notice ? <p className="rounded-[8px] bg-lua/10 p-3 text-sm text-lua">{notice}</p> : null}
          <label className="grid gap-1 text-sm font-semibold text-chamDeep">
            Mật khẩu mới
            <input name="password" type="password" minLength={8} autoComplete="new-password" required className="rounded-[8px] border border-line px-4 py-3 font-normal" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-chamDeep">
            Nhập lại mật khẩu mới
            <input name="confirmation" type="password" minLength={8} autoComplete="new-password" required className="rounded-[8px] border border-line px-4 py-3 font-normal" />
          </label>
          <button type="submit" disabled={loading || Boolean(notice)} className="button-primary w-full disabled:cursor-wait disabled:opacity-60">
            {loading ? "Đang cập nhật…" : "Đặt lại mật khẩu"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
