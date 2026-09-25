import Link from "next/link";
import { notFound } from "next/navigation";
import { ClosureExportButtons } from "@/components/reports/closure-export-buttons";
import { SiteHeader } from "@/components/site-header";
import { getCurrentAuth } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("vi-VN");
const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

type Summary = {
  total_received_vnd: number | string;
  completed_donation_count: number | string;
  donor_count: number | string;
  total_disbursed_vnd: number | string;
  valid_disbursement_count: number | string;
  evidence_file_count: number | string;
  pending_disbursement_count: number | string;
};

type PublicDisbursement = {
  id: string;
  amount: number | string;
  description: string;
  evidence_file_count: number;
  representative_approved_at: string | null;
  post_audited_at: string | null;
};

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function amount(value: number) {
  return `${money.format(value)}đ`;
}

export default async function CampaignClosurePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await getCurrentAuth();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, slug, title, summary, campaign_type, target_amount, status, owner_type, owner_user_id, organization_id, category, province, published_at, closed_at, created_at, updated_at, organizations(name, user_id)")
    .eq("id", params.id)
    .maybeSingle();

  if (campaignError || !campaign) notFound();
  const organization = relation(campaign.organizations as { name: string; user_id: string } | { name: string; user_id: string }[] | null);
  const isOwner = Boolean(auth.user && ((campaign.owner_type === "individual" && campaign.owner_user_id === auth.user.id) || (campaign.owner_type === "organization" && organization?.user_id === auth.user.id)));
  const canManage = auth.role === "admin" || isOwner;
  if (campaign.status !== "closed" && !canManage) notFound();

  const disbursementQuery = canManage
    ? supabase
      .from("disbursements")
      .select("id, amount, description, evidence_paths, representative_approved_at, post_audited_at")
      .eq("campaign_id", campaign.id)
      .in("status", ["representative_approved", "recorded", "published"])
      .eq("post_audit_status", "valid")
      .order("post_audited_at", { ascending: true })
    : supabase.rpc("get_public_campaign_disbursements", { p_campaign_id: campaign.id });

  const [summaryResult, disbursementResult, resourceResult, historyResult] = await Promise.all([
    supabase.rpc("get_campaign_closure_summary", { p_campaign_id: campaign.id }),
    disbursementQuery,
    supabase.rpc("get_public_resource_needs"),
    supabase.from("campaign_status_history").select("id, to_status, actor_name, actor_role, note, created_at").eq("campaign_id", campaign.id).order("created_at", { ascending: true }),
  ]);

  const loadError = summaryResult.error || disbursementResult.error
    ? "Chưa đọc được dữ liệu tất toán. Hãy áp dụng migration 202609250001_reports_and_campaign_closure.sql."
    : null;
  const summary = ((Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data) ?? {}) as Partial<Summary>;
  const disbursements = ((disbursementResult.data ?? []) as Array<Record<string, unknown>>).map((item) => ({
    id: String(item.id),
    amount: Number(item.amount ?? 0),
    description: String(item.description ?? "Khoản giải ngân"),
    evidence_file_count: Array.isArray(item.evidence_paths) ? item.evidence_paths.length : Number(item.evidence_file_count ?? 0),
    representative_approved_at: item.representative_approved_at ? String(item.representative_approved_at) : null,
    post_audited_at: item.post_audited_at ? String(item.post_audited_at) : null,
  })) satisfies PublicDisbursement[];
  const needs = ((resourceResult.data ?? []) as Array<Record<string, unknown>>).filter((item) => item.campaign_id === campaign.id);
  const totalReceived = Number(summary.total_received_vnd ?? 0);
  const totalDisbursed = Number(summary.total_disbursed_vnd ?? 0);
  const balance = totalReceived - totalDisbursed;
  const closedAt = campaign.closed_at ? date.format(new Date(campaign.closed_at)) : "Chưa đóng";
  const ownerName = campaign.owner_type === "organization" ? organization?.name ?? "Tổ chức thiện nguyện" : "Chủ chiến dịch cá nhân";
  const directExecutionTarget = campaign.campaign_type === "direct" ? totalReceived * 0.9 : totalReceived;
  const operatingTarget = campaign.campaign_type === "direct" ? totalReceived * 0.1 : 0;

  const exportData = {
    title: campaign.title,
    status: campaign.status === "closed" ? "Đã đóng" : "Tạm tính",
    closedAt,
    totalReceived,
    totalDisbursed,
    balance,
    donationCount: Number(summary.completed_donation_count ?? 0),
    donorCount: Number(summary.donor_count ?? 0),
    disbursements: disbursements.map((item) => ({ description: item.description, amount: Number(item.amount), evidenceCount: item.evidence_file_count, auditedAt: item.post_audited_at ?? item.representative_approved_at ?? "" })),
  };

  return <main className="min-h-screen bg-paper">
    <SiteHeader />
    <section className="mx-auto max-w-[1160px] px-6 py-8 sm:px-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm print:hidden"><Link href={canManage ? auth.role === "org" ? `/organization/campaigns/${campaign.id}` : `/campaign-management/${campaign.id}` : `/campaigns/${campaign.slug}`} className="font-bold text-sky hover:underline">← Quay lại chiến dịch</Link><Link href="/reports?tab=campaign" className="font-bold text-inkMid hover:text-son">Tất cả báo cáo →</Link></div>

      <header className="rounded-[18px] bg-chamDeep p-7 text-white sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${campaign.status === "closed" ? "bg-lua text-white" : "bg-nghe text-chamDeep"}`}>{campaign.status === "closed" ? `✓ Chiến dịch đã đóng · ${closedAt}` : "Bản tất toán tạm tính"}</span><h1 className="mt-4 font-serif text-3xl font-semibold sm:text-4xl">{campaign.title}</h1><p className="mt-3 text-sm text-white/60">{ownerName} · {campaign.published_at ? `Công khai từ ${date.format(new Date(campaign.published_at))}` : "Chưa có ngày công khai"}</p></div>
          <ClosureExportButtons report={exportData} />
        </div>
      </header>

      {loadError ? <div className="mt-5 rounded-[10px] border border-nghe/30 bg-nghe/10 p-4 text-sm text-ngheDeep">{loadError}</div> : null}
      {campaign.status !== "closed" ? <div className="mt-5 rounded-[10px] border border-nghe/30 bg-nghe/10 p-4 text-sm text-ngheDeep">Đây là số liệu tạm tính dành cho chủ chiến dịch/Admin. Báo cáo chỉ trở thành báo cáo đóng cổng khi Admin chuyển chiến dịch sang trạng thái “Đã đóng”.</div> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[[amount(totalReceived), "Tổng tiền thực nhận", "text-lua"], [amount(totalDisbursed), "Giải ngân hậu kiểm hợp lệ", "text-son"], [amount(balance), balance >= 0 ? "Số dư chưa giải ngân" : "Giải ngân vượt thực nhận", balance >= 0 ? "text-ngheDeep" : "text-son"], [money.format(Number(summary.donor_count ?? 0)), "Nhà hảo tâm", "text-chamDeep"]].map(([value, label, color]) => <div key={label} className="rounded-[12px] border border-line bg-white p-5"><p className={`font-serif text-2xl font-bold ${color}`}>{value}</p><p className="mt-1 text-xs text-inkSoft">{label}</p></div>)}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <section className="rounded-[14px] border border-line bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Cashflow Tree</p><h2 className="mt-1 font-serif text-xl font-semibold text-chamDeep">Dòng tiền chiến dịch</h2></div><strong className="font-mono text-xl text-son">{amount(totalReceived)}</strong></div>
            <div className="mt-5 space-y-3"><div className="rounded-[10px] border border-lua/40 bg-lua/10 p-4"><div className="flex justify-between gap-3 font-bold text-chamDeep"><span>💰 Nguồn ủng hộ đã xác nhận ({money.format(Number(summary.completed_donation_count ?? 0))} lượt)</span><span className="font-mono text-lua">{amount(totalReceived)}</span></div></div>
              <div className="ml-6 rounded-[10px] border border-son/30 bg-son/10 p-4"><div className="flex justify-between gap-3 font-bold text-chamDeep"><span>📋 Giải ngân đã hậu kiểm hợp lệ</span><span className="font-mono text-son">{amount(totalDisbursed)}</span></div><p className="mt-1 text-xs text-inkSoft">{money.format(Number(summary.valid_disbursement_count ?? 0))} hồ sơ · {money.format(Number(summary.evidence_file_count ?? 0))} tệp bằng chứng</p></div>
              <div className="ml-6 rounded-[10px] border border-nghe/30 bg-nghe/10 p-4"><div className="flex justify-between gap-3 font-bold text-chamDeep"><span>🧾 Số dư chưa giải ngân</span><span className="font-mono text-ngheDeep">{amount(balance)}</span></div></div>
            </div>
          </section>

          <section className="rounded-[14px] border border-line bg-white p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-serif text-xl font-semibold text-chamDeep">Khoản giải ngân đã xác minh</h2><span className="text-xs text-inkSoft">{disbursements.length} khoản</span></div>{disbursements.length === 0 ? <p className="mt-5 rounded-[8px] bg-paper p-5 text-sm text-inkSoft">Chưa có khoản giải ngân nào được Admin hậu kiểm hợp lệ để công khai.</p> : <div className="mt-5 space-y-3">{disbursements.map((item) => <article key={item.id} className="rounded-[9px] border border-line bg-paper p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-chamDeep">{item.description}</p><p className="mt-1 text-xs text-inkSoft">Hậu kiểm: {item.post_audited_at ? dateTime.format(new Date(item.post_audited_at)) : "Chưa cập nhật"} · {item.evidence_file_count} tệp bằng chứng</p></div><strong className="font-mono text-son">{amount(Number(item.amount))}</strong></div></article>)}</div>}</section>

          <section className="rounded-[14px] border border-line bg-white p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-serif text-xl font-semibold text-chamDeep">Nguồn lực phi tiền tệ đã xác minh</h2><span className="text-xs text-inkSoft">{needs.length} nhu cầu</span></div>{needs.length === 0 ? <p className="mt-5 text-sm text-inkSoft">Chiến dịch chưa có nhu cầu nguồn lực công khai.</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{needs.map((need) => <article key={String(need.id)} className="rounded-[9px] border border-line bg-paper p-4"><p className="font-bold text-chamDeep">{String(need.name)}</p><p className="mt-2 text-sm text-inkMid">Đã bàn giao: <strong>{money.format(Number(need.claimed_quantity ?? 0))} / {money.format(Number(need.quantity_needed ?? 0))} {String(need.unit)}</strong></p></article>)}</div>}</section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[14px] border border-line bg-white p-6"><h2 className="font-serif text-lg font-semibold text-chamDeep">Đối chiếu chính sách</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-inkSoft">Loại chiến dịch</dt><dd className="font-bold text-chamDeep">{campaign.campaign_type === "direct" ? "Trực tiếp" : "Kết nối"}</dd></div><div className="flex justify-between gap-3"><dt className="text-inkSoft">Mục tiêu</dt><dd className="font-mono font-bold">{amount(Number(campaign.target_amount))}</dd></div>{campaign.campaign_type === "direct" ? <><div className="flex justify-between gap-3"><dt className="text-inkSoft">90% thực thi dự kiến</dt><dd className="font-mono font-bold text-lua">{amount(directExecutionTarget)}</dd></div><div className="flex justify-between gap-3"><dt className="text-inkSoft">10% vận hành dự kiến</dt><dd className="font-mono font-bold text-ngheDeep">{amount(operatingTarget)}</dd></div></> : null}<div className="flex justify-between gap-3"><dt className="text-inkSoft">Hồ sơ chờ hậu kiểm</dt><dd className="font-bold text-son">{money.format(Number(summary.pending_disbursement_count ?? 0))}</dd></div></dl><p className="mt-4 rounded-[8px] bg-paper p-3 text-xs leading-5 text-inkSoft">Tỷ lệ 90/10 chỉ là mức phân bổ dự kiến của chiến dịch Trực tiếp. “Đã giải ngân” chỉ tính hồ sơ thực tế được hậu kiểm hợp lệ.</p></section>
          <section className="rounded-[14px] border border-line bg-white p-6"><h2 className="font-serif text-lg font-semibold text-chamDeep">Mốc kiểm soát</h2><ol className="mt-4 space-y-4 border-l border-line pl-5">{(historyResult.data ?? []).map((event) => <li key={event.id} className="relative"><span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-sky" /><p className="text-sm font-bold text-chamDeep">{event.to_status}</p><p className="mt-0.5 text-xs text-inkSoft">{event.actor_name} · {dateTime.format(new Date(event.created_at))}</p>{event.note ? <p className="mt-1 text-xs text-son">{event.note}</p> : null}</li>)}</ol></section>
        </aside>
      </div>
    </section>
  </main>;
}
