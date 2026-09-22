import { SiteHeader } from "@/components/site-header";
import { RescueApplyForm } from "@/components/rescue/rescue-apply-form";
import { requireAuthenticatedPage } from "@/lib/auth/server";

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "Chờ duyệt", className: "bg-nghe/15 text-ngheDeep" },
  needs_revision: { label: "Cần bổ sung", className: "bg-sky/15 text-sky" },
  approved: { label: "Đã duyệt", className: "bg-lua/15 text-lua" },
  rejected: { label: "Từ chối", className: "bg-son/15 text-son" },
};

export default async function RescueApplyPage() {
  const { supabase, user } = await requireAuthenticatedPage("/rescue/apply");

  const { data: existing } = await supabase
    .from("rescue_applications")
    .select("id, status, review_note, team_name, created_at")
    .eq("submitted_by", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const canSubmitNew = !existing || existing.status === "rejected";

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-[720px] px-7 py-10">
        <p className="eyebrow">Luồng riêng</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-chamDeep">Hồ sơ hoạt động cứu trợ</h1>
        <p className="mt-3 leading-7 text-inkMid">
          Đăng ký cá nhân/đội cứu trợ tự phát. Gửi hồ sơ không tự kích hoạt tài khoản — chỉ Admin xem xét và cấp quyền điều phối sau khi duyệt.
        </p>

        {existing ? (
          <div className="mt-8 rounded-[14px] border border-line bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-lg font-semibold text-chamDeep">Hồ sơ gần nhất{existing.team_name ? ` — ${existing.team_name}` : ""}</h2>
              <span className={`rounded-[4px] px-2 py-1 text-xs font-bold ${statusLabels[existing.status]?.className ?? "bg-inkSoft/15 text-inkSoft"}`}>
                {statusLabels[existing.status]?.label ?? existing.status}
              </span>
            </div>
            {existing.review_note ? <p className="mt-2 rounded-[8px] bg-paper p-3 text-sm text-inkMid">Ghi chú từ Admin: {existing.review_note}</p> : null}
            {!canSubmitNew ? (
              <p className="mt-3 text-sm text-inkSoft">
                {existing.status === "pending" ? "Hồ sơ đang chờ Admin xem xét." : "Hồ sơ đã được duyệt — tài khoản cứu trợ đã kích hoạt (nếu đủ điều kiện)."}
              </p>
            ) : null}
          </div>
        ) : null}

        {canSubmitNew ? (
          <div className="mt-8">
            <RescueApplyForm />
          </div>
        ) : null}
      </section>
    </main>
  );
}
