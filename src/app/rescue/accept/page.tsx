import { SiteHeader } from "@/components/site-header";
import { RescueInviteAcceptForm } from "@/components/rescue/rescue-invite-accept-form";

export default function RescueAcceptPage({ searchParams }: { searchParams?: { token?: string | string[] } }) {
  const activationToken = typeof searchParams?.token === "string" ? searchParams.token : undefined;

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-[520px] px-7 py-16">
        <p className="eyebrow">Lời mời nội bộ</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-chamDeep">Kích hoạt tài khoản cứu trợ</h1>
        <p className="mt-3 leading-7 text-inkMid">
          Link này được gửi bởi Admin Thiện Nguyện. Hãy đặt mật khẩu riêng để hoàn tất kích hoạt tài khoản đội cứu trợ.
        </p>
        <div className="mt-8">
          <RescueInviteAcceptForm activationToken={activationToken} />
        </div>
      </section>
    </main>
  );
}
