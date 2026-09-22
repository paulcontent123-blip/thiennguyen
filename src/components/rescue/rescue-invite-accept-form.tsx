"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { activateRescueInvitation, markRescueInvitationAccepted } from "@/app/rescue/accept/actions";
import { createClient } from "@/lib/supabase/client";

export function RescueInviteAcceptForm({ activationToken }: { activationToken?: string }) {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (activationToken) {
      // Remove the raw activation token from the visible URL and browser
      // history. The component still keeps it in memory for the explicit form
      // submission below; visiting the page alone never consumes a token.
      window.history.replaceState(null, "", "/rescue/accept");
      setCheckingSession(false);
      return;
    }

    const supabase = createClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasSession(Boolean(session));
      setCheckingSession(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [activationToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);

    if (activationToken) {
      const result = await activateRescueInvitation(activationToken, password);
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    try {
      await markRescueInvitationAccepted();
    } catch (acceptError) {
      console.error("Could not mark rescue invitation as accepted", acceptError);
    }
    setLoading(false);
    setSuccess(true);
  }

  if (checkingSession) {
    return <div className="rounded-[14px] border border-line bg-white p-6 text-sm text-inkMid">Đang xác nhận lời mời…</div>;
  }

  if (!activationToken && !hasSession) {
    return (
      <div className="rounded-[14px] border border-nghe/30 bg-nghe/10 p-6 text-sm leading-6 text-ngheDeep">
        Liên kết mời không còn phiên xác thực. Hãy mở trực tiếp liên kết mới nhất trong email hoặc liên hệ Admin để gửi lại lời mời.
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-[14px] border border-lua/30 bg-lua/10 p-6 text-center text-sm text-lua">
        Đã xác nhận lời mời và đặt mật khẩu thành công.
        <button type="button" onClick={() => router.push("/rescue/operations")} className="button-primary mt-4 inline-flex">
          Vào điều phối cứu trợ
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[14px] border border-line bg-white p-6">
      {error ? <p className="rounded-[8px] bg-son/10 p-3 text-sm text-son">{error}</p> : null}
      <label className="grid gap-1 text-sm font-semibold text-chamDeep">
        Mật khẩu mới
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} required className="rounded-[8px] border border-line px-4 py-3 font-normal" />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-chamDeep">
        Nhập lại mật khẩu
        <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type="password" minLength={8} required className="rounded-[8px] border border-line px-4 py-3 font-normal" />
      </label>
      <button type="submit" disabled={loading} className="button-primary w-full disabled:cursor-wait disabled:opacity-60">
        {loading ? "Đang xác nhận…" : activationToken ? "Bắt đầu kích hoạt và đặt mật khẩu" : "Xác nhận và đặt mật khẩu"}
      </button>
    </form>
  );
}
