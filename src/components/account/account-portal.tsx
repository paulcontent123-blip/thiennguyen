"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/account/actions";
import type { AppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

const ROLE_LABELS: Record<AppRole, string> = {
  donor: "Nhà hảo tâm",
  org: "Tổ chức",
  rescue_team: "Đội cứu trợ",
  admin: "Quản trị viên",
};

type Notice = { type: "success" | "error"; message: string } | null;

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p className={`rounded-[8px] px-3 py-2.5 text-sm ${notice.type === "success" ? "bg-lua/10 text-lua" : "bg-son/10 text-son"}`}>
      {notice.message}
    </p>
  );
}

export function AccountPortal({ email, fullName, phone, role }: { email: string; fullName: string; phone: string; role: AppRole }) {
  const router = useRouter();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [sessionNotice, setSessionNotice] = useState<Notice>(null);

  async function handleProfile(formData: FormData) {
    setProfileLoading(true);
    setProfileNotice(null);
    try {
      const result = await updateProfile(formData);
      setProfileNotice({ type: result.ok ? "success" : "error", message: result.message });
      if (result.ok) router.refresh();
    } catch {
      setProfileNotice({ type: "error", message: "Phiên đăng nhập không hợp lệ hoặc bạn không có quyền cập nhật." });
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePassword(formData: FormData) {
    setPasswordLoading(true);
    setPasswordNotice(null);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");

    if (password.length < 8) {
      setPasswordLoading(false);
      setPasswordNotice({ type: "error", message: "Mật khẩu mới phải có ít nhất 8 ký tự." });
      return;
    }
    if (password !== confirmation) {
      setPasswordLoading(false);
      setPasswordNotice({ type: "error", message: "Mật khẩu xác nhận không khớp." });
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPasswordLoading(false);
    setPasswordNotice(
      error
        ? { type: "error", message: error.message }
        : { type: "success", message: "Đã thay đổi mật khẩu. Hãy dùng mật khẩu mới ở lần đăng nhập tiếp theo." },
    );
  }

  async function handleGlobalLogout() {
    setSessionLoading(true);
    setSessionNotice(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      setSessionLoading(false);
      setSessionNotice({ type: "error", message: "Không thể đăng xuất các thiết bị. Vui lòng thử lại." });
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Tài khoản</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-chamDeep">Thông tin cá nhân</h1>
          <p className="mt-2 text-sm text-inkMid">Quản lý hồ sơ, mật khẩu và các phiên đăng nhập của bạn.</p>
        </div>
        <span className="rounded-full bg-son/10 px-3 py-1.5 text-xs font-bold text-son">{ROLE_LABELS[role]}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <form action={handleProfile} className="panel space-y-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-chamDeep">Hồ sơ</h2>
            <p className="mt-1 text-sm text-inkSoft">Tên hiển thị được sử dụng trên menu tài khoản.</p>
          </div>
          <NoticeBox notice={profileNotice} />
          <label className="grid gap-1 text-sm font-semibold text-chamDeep">
            Họ và tên
            <input name="fullName" defaultValue={fullName} minLength={2} maxLength={100} required className="rounded-[8px] border border-line px-4 py-3 font-normal" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-chamDeep">
            Email
            <input value={email} disabled className="rounded-[8px] border border-line bg-paper px-4 py-3 font-normal text-inkSoft" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-chamDeep">
            Số điện thoại
            <input name="phone" defaultValue={phone} maxLength={20} placeholder="0901 234 567" className="rounded-[8px] border border-line px-4 py-3 font-normal" />
          </label>
          <button type="submit" disabled={profileLoading} className="button-primary disabled:cursor-wait disabled:opacity-60">
            {profileLoading ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </form>

        <div className="space-y-5">
          <form action={handlePassword} className="panel space-y-4">
            <div>
              <h2 className="font-serif text-xl font-semibold text-chamDeep">Đổi mật khẩu</h2>
              <p className="mt-1 text-sm text-inkSoft">Sử dụng tối thiểu 8 ký tự.</p>
            </div>
            <NoticeBox notice={passwordNotice} />
            <label className="grid gap-1 text-sm font-semibold text-chamDeep">
              Mật khẩu mới
              <input name="password" type="password" minLength={8} required className="rounded-[8px] border border-line px-4 py-3 font-normal" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-chamDeep">
              Xác nhận mật khẩu
              <input name="confirmation" type="password" minLength={8} required className="rounded-[8px] border border-line px-4 py-3 font-normal" />
            </label>
            <button type="submit" disabled={passwordLoading} className="rounded-[40px] border border-lineStrong px-5 py-2.5 text-sm font-bold text-chamDeep transition hover:border-son hover:text-son disabled:cursor-wait disabled:opacity-60">
              {passwordLoading ? "Đang cập nhật…" : "Đổi mật khẩu"}
            </button>
          </form>

          <div className="panel space-y-4">
            <div>
              <h2 className="font-serif text-xl font-semibold text-chamDeep">Phiên đăng nhập</h2>
              <p className="mt-1 text-sm leading-6 text-inkSoft">Đăng xuất tài khoản khỏi tất cả trình duyệt và thiết bị đang sử dụng.</p>
            </div>
            <NoticeBox notice={sessionNotice} />
            <button type="button" onClick={handleGlobalLogout} disabled={sessionLoading} className="rounded-[40px] bg-son/10 px-5 py-2.5 text-sm font-bold text-son transition hover:bg-son/15 disabled:cursor-wait disabled:opacity-60">
              {sessionLoading ? "Đang đăng xuất…" : "Đăng xuất tất cả thiết bị"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

