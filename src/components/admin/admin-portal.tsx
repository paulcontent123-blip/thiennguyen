"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  activateCampaign,
  approveCampaign,
  closeCampaign,
  approveOrganization,
  approveRescueApplication,
  markSosHandled,
  postAuditDisbursement,
  rejectCampaign,
  rejectOrganization,
  rejectRescueApplication,
  requestCampaignRevision,
  requestOrganizationRevision,
} from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";

type FormAction = (formData: FormData) => void | Promise<void>;
type Related<T> = T | T[] | null;

type Campaign = {
  id: string;
  title: string;
  campaign_type: "direct" | "partner" | string;
  target_amount: number | string;
  status: string;
  review_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  organizations: Related<{ name: string }>;
  campaign_status_history: Array<{
    id: number;
    from_status: string | null;
    to_status: string;
    actor_name: string;
    actor_role: string | null;
    note: string | null;
    created_at: string;
  }>;
};

type Organization = {
  id: string;
  name: string;
  legal_representative_name: string;
  license_status: string;
  license_number: string | null;
  license_note: string | null;
  license_file_path: string | null;
  created_at: string;
};

type Disbursement = {
  id: string;
  amount: number | string;
  description: string;
  status: string;
  evidence_paths: string[];
  submitted_at: string | null;
  representative_approved_at: string | null;
  post_audit_status: string;
  post_audited_at: string | null;
  post_audit_note: string | null;
  campaigns: Related<{ title: string }>;
};

type RescueApplication = {
  id: string;
  team_name: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  resource_types: string[];
  province: string | null;
  radius_km: number | null;
  submitted_by: string | null;
  status: string;
  created_at: string;
};

type SosReport = {
  id: string;
  location_text: string;
  needs: string[];
  contact_phone: string | null;
  status: string;
  created_at: string;
};

type Panel = "overview" | "campaigns" | "kyc" | "disbursement" | "sos";
type CampaignFilter = "all" | "pending_review" | "needs_revision" | "approved";
type AuditFilter = "pending" | "reviewed";

const currency = new Intl.NumberFormat("vi-VN");
const datetime = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function fmtDate(value: string | null | undefined) {
  return value ? datetime.format(new Date(value)) : "—";
}

function amount(value: number | string) {
  return `${currency.format(Number(value) || 0)}đ`;
}

function firstRelated<T>(value: Related<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

const statusPill: Record<string, { label: string; className: string }> = {
  pending: { label: "Chờ duyệt", className: "bg-nghe/15 text-ngheDeep" },
  pending_review: { label: "Chờ duyệt", className: "bg-nghe/15 text-ngheDeep" },
  needs_revision: { label: "Cần bổ sung", className: "bg-sky/15 text-sky" },
  approved: { label: "Đã duyệt", className: "bg-lua/15 text-lua" },
  active: { label: "Đang hoạt động", className: "bg-lua/15 text-lua" },
  closed: { label: "Đã đóng", className: "bg-inkSoft/15 text-inkSoft" },
  rejected: { label: "Từ chối", className: "bg-son/15 text-son" },
  draft: { label: "Nháp", className: "bg-inkSoft/15 text-inkSoft" },
  representative_approved: { label: "Chờ hậu kiểm", className: "bg-nghe/15 text-ngheDeep" },
  submitted: { label: "Đã nộp", className: "bg-sky/15 text-sky" },
  not_reviewed: { label: "Chưa hậu kiểm", className: "bg-inkSoft/15 text-inkSoft" },
  valid: { label: "Hợp lệ", className: "bg-lua/15 text-lua" },
  needs_explanation: { label: "Cần giải trình", className: "bg-nghe/15 text-ngheDeep" },
  violation: { label: "Vi phạm", className: "bg-son/15 text-son" },
  urgent: { label: "Khẩn cấp", className: "bg-son/15 text-son" },
  needs_support: { label: "Cần hỗ trợ", className: "bg-nghe/15 text-ngheDeep" },
  handled: { label: "Đã xử lý", className: "bg-lua/15 text-lua" },
};

function Pill({ status }: { status: string }) {
  const item = statusPill[status] ?? { label: status, className: "bg-inkSoft/15 text-inkSoft" };
  return <span className={`inline-flex rounded-[4px] px-2 py-0.5 text-xs font-bold ${item.className}`}>{item.label}</span>;
}

function CampaignHistory({ campaign }: { campaign: Campaign }) {
  const events = [...(campaign.campaign_status_history ?? [])].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer font-bold text-sky">Lịch sử trạng thái ({events.length})</summary>
      <ol className="mt-2 space-y-2 border-l border-line pl-3">
        {events.map((event) => (
          <li key={event.id}>
            <div className="font-semibold text-chamDeep">
              {event.from_status ? `${statusPill[event.from_status]?.label ?? event.from_status} → ` : "Khởi tạo → "}
              {statusPill[event.to_status]?.label ?? event.to_status}
            </div>
            <div className="text-inkSoft">{event.actor_name} ({event.actor_role ?? "system"}) · {fmtDate(event.created_at)}</div>
            {event.note ? <div className="mt-0.5 text-son">{event.note}</div> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

function ReviewActions({
  approveAction,
  reviseAction,
  rejectAction,
  reviseLabel = "Cần bổ sung",
}: {
  approveAction: FormAction;
  reviseAction?: FormAction;
  rejectAction: FormAction;
  reviseLabel?: string;
}) {
  return (
    <div className="grid gap-2">
      <form action={approveAction}><button className="rounded-[4px] bg-lua px-3 py-1.5 text-xs font-bold text-white transition hover:bg-lua/90">Duyệt</button></form>
      {reviseAction ? <form action={reviseAction} className="flex items-center gap-2"><input name="note" required placeholder="Lý do cần bổ sung" className="w-40 rounded-[4px] border border-line px-2 py-1 text-xs outline-none focus:border-son" /><button className="rounded-[4px] bg-sky/15 px-3 py-1.5 text-xs font-bold text-sky transition hover:bg-sky/25">{reviseLabel}</button></form> : null}
      <form action={rejectAction} className="flex items-center gap-2"><input name="note" required placeholder="Lý do từ chối" className="w-40 rounded-[4px] border border-line px-2 py-1 text-xs outline-none focus:border-son" /><button className="rounded-[4px] bg-son/15 px-3 py-1.5 text-xs font-bold text-son transition hover:bg-son/25">Từ chối</button></form>
    </div>
  );
}

function StatCard({ value, label, badge, positive = false }: { value: string | number; label: string; badge: string; positive?: boolean }) {
  return (
    <div className="rounded-[8px] border border-line bg-white p-4 shadow-[0_1px_4px_rgba(30,36,56,0.04)]">
      <div className="font-mono text-[21px] font-bold text-chamDeep">{value}</div>
      <div className="mt-1 text-xs text-inkSoft">{label}</div>
      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${positive ? "bg-lua/15 text-lua" : "bg-nghe/15 text-ngheDeep"}`}>{badge}</span>
    </div>
  );
}

function QuickCard({ icon, title, description, borderClass, onClick }: { icon: string; title: string; description: string; borderClass: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-[8px] border border-line border-l-4 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-card ${borderClass}`}>
      <div className="mb-1.5 text-xl">{icon}</div>
      <div className="text-sm font-bold text-chamDeep">{title}</div>
      <div className="mt-0.5 text-xs text-inkMid">{description}</div>
    </button>
  );
}

function AuditTimeline({ disbursement }: { disbursement: Disbursement }) {
  const representativeDone = Boolean(disbursement.representative_approved_at);
  const cashflowDone = ["recorded", "published"].includes(disbursement.status);
  const auditDone = disbursement.post_audit_status !== "not_reviewed";
  const steps = [
    { icon: "✍️", title: "Người đại diện pháp luật", done: representativeDone, active: !representativeDone, status: representativeDone ? "Đã ký & approval" : "Chờ ký/approval", detail: representativeDone ? fmtDate(disbursement.representative_approved_at) : "Chưa xử lý" },
    { icon: "💰", title: "Cashflow công khai", done: cashflowDone, active: representativeDone && !cashflowDone, status: cashflowDone ? "Đã ghi nhận" : "Chờ ghi nhận", detail: cashflowDone ? "Đã cập nhật" : "Chưa xử lý" },
    { icon: "🔍", title: "Admin hậu kiểm", done: auditDone, active: representativeDone && cashflowDone && !auditDone, status: auditDone ? statusPill[disbursement.post_audit_status]?.label ?? "Đã xử lý" : "Chờ hậu kiểm", detail: disbursement.post_audited_at ? fmtDate(disbursement.post_audited_at) : "Chưa xử lý" },
  ];

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
      {steps.map((step, index) => (
        <div key={step.title} className="flex min-w-0 flex-1 items-center gap-2">
          <div className={`w-full rounded-[8px] border p-3 text-center ${step.active ? "border-nghe bg-nghe/5" : step.done ? "border-lua/50 bg-lua/5" : "border-line bg-white"}`}>
            <div className="text-lg">{step.icon}</div>
            <div className="mt-1 text-xs font-bold text-chamDeep">{step.title}</div>
            <div className={`mt-1 text-xs font-bold ${step.active ? "text-ngheDeep" : step.done ? "text-lua" : "text-inkSoft"}`}>{step.done ? "✓ " : step.active ? "◷ " : ""}{step.status}</div>
            <div className="mt-0.5 text-[11px] text-inkSoft">{step.detail}</div>
          </div>
          {index < steps.length - 1 ? <span className="hidden shrink-0 text-inkSoft md:block">→</span> : null}
        </div>
      ))}
    </div>
  );
}

export function AdminPortal({ campaigns, organizations, disbursements, rescueApplications, sosReports }: { campaigns: Campaign[]; organizations: Organization[]; disbursements: Disbursement[]; rescueApplications: RescueApplication[]; sosReports: SosReport[] }) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>("overview");
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>("all");
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("pending");
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

  const pendingCampaigns = campaigns.filter((campaign) => campaign.status === "pending_review").length;
  const pendingOrganizations = organizations.filter((organization) => organization.license_status === "pending").length;
  const pendingRescue = rescueApplications.filter((application) => application.status === "pending").length;
  const unhandledSos = sosReports.filter((report) => report.status !== "handled").length;
  const urgentSos = sosReports.filter((report) => report.status === "urgent").length;
  const totalDisbursement = disbursements.reduce((total, item) => total + (Number(item.amount) || 0), 0);

  const filteredCampaigns = useMemo(() => {
    if (campaignFilter === "all") return campaigns;
    if (campaignFilter === "approved") return campaigns.filter((campaign) => ["approved", "active", "closed"].includes(campaign.status));
    return campaigns.filter((campaign) => campaign.status === campaignFilter);
  }, [campaignFilter, campaigns]);

  const pendingDisbursements = disbursements.filter((item) => item.status === "representative_approved" && item.post_audit_status === "not_reviewed");
  const auditedDisbursements = disbursements.filter((item) => item.post_audit_status !== "not_reviewed").slice(0, 8);
  const visibleDisbursements = auditFilter === "pending" ? pendingDisbursements : auditedDisbursements;

  const recentActivity = useMemo(() => {
    const items: { time: string; icon: string; label: string; detail: string; status: string }[] = [];
    campaigns.slice(0, 5).forEach((campaign) => items.push({ time: campaign.created_at, icon: "🎯", label: "Chiến dịch", detail: `${campaign.title} · ${firstRelated(campaign.organizations)?.name ?? ""}`, status: campaign.status }));
    organizations.slice(0, 5).forEach((organization) => items.push({ time: organization.created_at, icon: "🏛️", label: "KYC", detail: organization.name, status: organization.license_status }));
    rescueApplications.slice(0, 5).forEach((application) => items.push({ time: application.created_at, icon: "🚑", label: "Cứu trợ", detail: application.team_name ?? application.contact_name, status: application.status }));
    sosReports.slice(0, 5).forEach((report) => items.push({ time: report.created_at, icon: "🚨", label: "SOS", detail: report.location_text, status: report.status }));
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);
  }, [campaigns, organizations, rescueApplications, sosReports]);

  const navItems: { key: Panel; icon: string; label: string }[] = [
    { key: "overview", icon: "📊", label: "Tổng quan" },
    { key: "campaigns", icon: "🎯", label: "Duyệt chiến dịch" },
    { key: "kyc", icon: "📋", label: "Xác minh giấy phép" },
    { key: "disbursement", icon: "💰", label: "Hậu kiểm giải ngân" },
    { key: "sos", icon: "📍", label: "SOS Reports" },
  ];

  return (
    <div className="min-h-screen bg-paperMid lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="flex flex-col bg-chamDeep px-3 py-5 text-white lg:min-h-screen lg:px-0 lg:py-6">
        <div className="border-b border-white/10 px-2 pb-4 lg:px-5"><div className="text-sm text-white/65">Thiện Nguyện</div><strong className="font-serif text-[17px]">Admin Portal</strong></div>
        <nav className="flex gap-1 overflow-x-auto pt-3 lg:flex-col lg:gap-0 lg:px-0">
          {navItems.map((item) => <button key={item.key} type="button" onClick={() => setPanel(item.key)} className={`flex shrink-0 items-center gap-2.5 border-l-[3px] px-3 py-2.5 text-left text-[13px] transition lg:px-5 ${panel === item.key ? "border-l-son bg-white/10 font-bold text-white" : "border-l-transparent text-white/65 hover:bg-white/[0.06] hover:text-white"}`}><span className="w-[18px] text-center">{item.icon}</span>{item.label}</button>)}
        </nav>
        <div className="mt-4 border-t border-white/10 pt-3 lg:mt-auto lg:px-3 lg:pt-4">
          <Link href="/" className="flex items-center gap-2.5 px-2 py-2.5 text-[13px] text-white/65 transition hover:text-white"><span className="w-[18px] text-center">←</span>Về trang chủ</Link>
          <button type="button" onClick={handleLogout} disabled={loggingOut} className="flex w-full items-center gap-2.5 rounded-[4px] px-2 py-2.5 text-left text-[13px] font-bold text-white/75 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60">
            <span className="w-[18px] text-center">↪</span>{loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
          {logoutError ? <p className="px-2 pt-1 text-xs text-red-300">{logoutError}</p> : null}
        </div>
      </aside>

      <main className="min-w-0 bg-paper p-4 sm:p-6 lg:p-[30px]">
        {panel === "overview" ? <section>
          <h1 className="mb-5 font-serif text-[21px] font-medium text-chamDeep">Tổng quan hệ thống</h1>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard value={pendingCampaigns} label="Chiến dịch chờ duyệt" badge={pendingCampaigns ? "Cần xử lý" : "Đã kiểm tra"} />
            <StatCard value={pendingOrganizations} label="Tổ chức chờ KYC" badge={pendingOrganizations ? "Cần xác minh" : "Không có hồ sơ chờ"} />
            <StatCard value={unhandledSos} label="SOS chưa xử lý" badge={urgentSos ? `${urgentSos} khẩn cấp` : "Không có khẩn cấp"} />
            <StatCard value={amount(totalDisbursement)} label="Tổng tiền đã ghi nhận" badge="Theo dữ liệu giải ngân" positive />
          </div>
          <div className="mb-[22px] grid gap-3 md:grid-cols-3">
            <QuickCard icon="🎯" title={`${pendingCampaigns} chiến dịch`} description="đang chờ duyệt" borderClass="border-l-son" onClick={() => setPanel("campaigns")} />
            <QuickCard icon="💰" title={`${pendingDisbursements.length} hồ sơ giải ngân`} description="chờ hậu kiểm bằng chứng" borderClass="border-l-nghe" onClick={() => setPanel("disbursement")} />
            <QuickCard icon="📋" title={`${pendingOrganizations} tổ chức`} description="chờ xác minh giấy phép" borderClass="border-l-sky" onClick={() => setPanel("kyc")} />
          </div>
          <div className="overflow-hidden rounded-[8px] border border-line bg-white">
            <div className="border-b border-line px-4 py-3.5 text-sm font-bold text-chamDeep">Hoạt động gần đây</div>
            <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-[13px]"><thead className="bg-paper text-left text-[11px] font-bold uppercase tracking-[0.04em] text-inkMid"><tr><th className="px-3 py-2.5">Thời gian</th><th className="px-3 py-2.5">Sự kiện</th><th className="px-3 py-2.5">Chi tiết</th><th className="px-3 py-2.5">Trạng thái</th></tr></thead><tbody>{recentActivity.length === 0 ? <tr><td colSpan={4} className="px-3 py-7 text-center text-inkSoft">Chưa có hoạt động nào.</td></tr> : recentActivity.map((activity, index) => <tr key={`${activity.time}-${index}`} className="border-t border-line"><td className="px-3 py-2.5 text-xs text-inkSoft">{fmtDate(activity.time)}</td><td className="px-3 py-2.5">{activity.icon} {activity.label}</td><td className="px-3 py-2.5 text-inkMid">{activity.detail}</td><td className="px-3 py-2.5"><Pill status={activity.status} /></td></tr>)}</tbody></table></div>
          </div>
        </section> : null}

        {panel === "campaigns" ? <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="font-serif text-[21px] font-medium text-chamDeep">Duyệt chiến dịch</h1><div className="flex flex-wrap gap-1.5">{[["all", `Tất cả (${campaigns.length})`], ["pending_review", `Chờ (${campaigns.filter((c) => c.status === "pending_review").length})`], ["needs_revision", `Cần bổ sung (${campaigns.filter((c) => c.status === "needs_revision").length})`], ["approved", `Đã duyệt (${campaigns.filter((c) => ["approved", "active", "closed"].includes(c.status)).length})`]].map(([value, label]) => <button key={value} type="button" onClick={() => setCampaignFilter(value as CampaignFilter)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${campaignFilter === value ? "border-son text-son" : "border-lineStrong text-inkMid hover:border-son hover:text-son"}`}>{label}</button>)}</div></div>
          <div className="overflow-x-auto rounded-[8px] border border-line bg-white"><table className="w-full min-w-[900px] text-[13px]"><thead className="bg-paper text-left text-[11px] font-bold uppercase tracking-[0.04em] text-inkMid"><tr><th className="px-3 py-2.5">Chiến dịch</th><th className="px-3 py-2.5">Tổ chức</th><th className="px-3 py-2.5">Loại</th><th className="px-3 py-2.5">Mục tiêu</th><th className="px-3 py-2.5">Ngày gửi</th><th className="px-3 py-2.5">Trạng thái</th><th className="px-3 py-2.5">Thao tác</th></tr></thead><tbody>{filteredCampaigns.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-inkSoft">Không có chiến dịch nào.</td></tr> : filteredCampaigns.map((campaign) => <tr key={campaign.id} className="border-t border-line align-top"><td className="px-3 py-3"><div className="font-semibold text-chamDeep">{campaign.title}</div>{campaign.review_note ? <div className="mt-1 text-xs text-son">Lý do: {campaign.review_note}</div> : null}<CampaignHistory campaign={campaign} /></td><td className="px-3 py-3 text-inkMid">{firstRelated(campaign.organizations)?.name ?? "—"}</td><td className="px-3 py-3 text-inkMid">{campaign.campaign_type === "direct" ? "Trực tiếp" : "Kết nối"}</td><td className="px-3 py-3 font-mono font-bold text-son">{amount(campaign.target_amount)}</td><td className="px-3 py-3 text-xs text-inkSoft">{fmtDate(campaign.submitted_at ?? campaign.created_at)}</td><td className="px-3 py-3"><Pill status={campaign.status} /></td><td className="px-3 py-3">{campaign.status === "pending_review" ? <ReviewActions approveAction={approveCampaign.bind(null, campaign.id)} reviseAction={requestCampaignRevision.bind(null, campaign.id)} rejectAction={rejectCampaign.bind(null, campaign.id)} /> : campaign.status === "approved" ? <form><button formAction={activateCampaign.bind(null, campaign.id)} className="rounded-[4px] bg-lua px-3 py-1.5 text-xs font-bold text-white">Kích hoạt</button></form> : campaign.status === "active" ? <form><button formAction={closeCampaign.bind(null, campaign.id)} className="rounded-[4px] bg-chamDeep px-3 py-1.5 text-xs font-bold text-white">Đóng chiến dịch</button></form> : <span className="text-xs text-inkSoft">—</span>}</td></tr>)}</tbody></table></div>
        </section> : null}

        {panel === "kyc" ? <section>
          <h1 className="mb-5 font-serif text-[21px] font-medium text-chamDeep">Xác minh giấy phép tổ chức</h1>
          <div className="grid gap-4 lg:grid-cols-2">{organizations.length === 0 ? <div className="rounded-[8px] border border-line bg-white p-6 text-sm text-inkSoft">Chưa có tổ chức nào đăng ký.</div> : organizations.map((organization) => <div key={organization.id} className={`rounded-[8px] border bg-white p-4 ${organization.license_status === "approved" ? "border-lua" : "border-line"}`}><div className="flex items-start justify-between gap-3"><div><div className="font-serif text-base font-semibold text-chamDeep">{organization.name}</div><div className="mt-1 text-xs text-inkSoft">Người đại diện: {organization.legal_representative_name}</div></div><Pill status={organization.license_status} /></div><div className="mt-3 divide-y divide-line rounded-[4px] bg-paper px-3"><div className="flex items-center justify-between gap-3 py-2 text-xs"><span className="text-inkMid">Số giấy phép</span><strong className="text-chamDeep">{organization.license_number ?? "Chưa cung cấp"}</strong></div><div className="flex items-center justify-between gap-3 py-2 text-xs"><span className="text-inkMid">Tài liệu</span>{organization.license_file_path ? organization.license_file_path.startsWith("http") ? <a href={organization.license_file_path} target="_blank" rel="noreferrer" className="font-bold text-sky hover:underline">Mở giấy phép ↗</a> : <span className="font-bold text-lua">Đã upload</span> : <span className="font-bold text-son">Chưa upload</span>}</div></div>{organization.license_note ? <div className="mt-3 rounded-[4px] bg-nghe/10 p-2 text-xs text-ngheDeep">Ghi chú: {organization.license_note}</div> : null}{organization.license_status === "pending" || organization.license_status === "needs_revision" ? <div className="mt-3"><ReviewActions approveAction={approveOrganization.bind(null, organization.id)} reviseAction={requestOrganizationRevision.bind(null, organization.id)} rejectAction={rejectOrganization.bind(null, organization.id)} /></div> : null}</div>)}</div>
        </section> : null}

        {panel === "disbursement" ? <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="font-serif text-[21px] font-medium text-chamDeep">Hậu kiểm bằng chứng giải ngân</h1><div className="flex gap-1.5"><button type="button" onClick={() => setAuditFilter("pending")} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${auditFilter === "pending" ? "border-son text-son" : "border-lineStrong text-inkMid"}`}>Chờ hậu kiểm ({pendingDisbursements.length})</button><button type="button" onClick={() => setAuditFilter("reviewed")} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${auditFilter === "reviewed" ? "border-son text-son" : "border-lineStrong text-inkMid"}`}>Đã xử lý ({auditedDisbursements.length})</button></div></div>
          {auditFilter === "pending" ? <div className="space-y-4">{visibleDisbursements.length === 0 ? <div className="rounded-[8px] border border-line bg-white px-4 py-8 text-center text-sm text-inkSoft">Không có hồ sơ nào đang chờ hậu kiểm.</div> : null}{visibleDisbursements.map((disbursement) => <div key={disbursement.id} className="rounded-[8px] border border-line bg-white p-4"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><div className="font-bold text-chamDeep">{firstRelated(disbursement.campaigns)?.title ?? "—"}</div><div className="mt-1 font-mono font-bold text-son">{amount(disbursement.amount)}</div></div><div className="text-xs text-inkSoft">Đại diện approval: {fmtDate(disbursement.representative_approved_at)}</div></div><div className="mb-4 text-sm text-inkMid">{disbursement.description}</div><div className="mb-3 text-sm font-bold text-chamDeep">Chữ ký người đại diện & hậu kiểm</div><AuditTimeline disbursement={disbursement} /><div className="mt-3 flex flex-wrap items-center gap-2"><span className="mr-2 text-xs text-inkSoft">{disbursement.evidence_paths.length} tệp bằng chứng đã cung cấp</span><form className="flex flex-wrap items-center gap-2"><input name="note" placeholder="Ghi chú hậu kiểm" className="w-48 rounded-[4px] border border-line px-2 py-1.5 text-xs outline-none focus:border-son" /><button formAction={postAuditDisbursement.bind(null, disbursement.id, "valid")} className="rounded-[4px] bg-lua px-3 py-1.5 text-xs font-bold text-white">✅ Hậu kiểm hợp lệ</button><button formAction={postAuditDisbursement.bind(null, disbursement.id, "needs_explanation")} className="rounded-[4px] bg-sky/15 px-3 py-1.5 text-xs font-bold text-sky">Yêu cầu giải trình</button><button formAction={postAuditDisbursement.bind(null, disbursement.id, "violation")} className="rounded-[4px] bg-son/15 px-3 py-1.5 text-xs font-bold text-son">Đánh dấu vi phạm</button></form></div><div className="mt-3 rounded-[4px] bg-nghe/10 px-3 py-2 text-xs text-ngheDeep">🔒 Tài liệu do người đại diện cung cấp; Admin chỉ thực hiện hậu kiểm và ghi nhận kết quả.</div></div>)}</div> : <div className="overflow-x-auto rounded-[8px] border border-line bg-white"><table className="w-full min-w-[700px] text-[13px]"><thead className="bg-paper text-left text-[11px] font-bold uppercase tracking-[0.04em] text-inkMid"><tr><th className="px-3 py-2.5">Ngày</th><th className="px-3 py-2.5">Chiến dịch</th><th className="px-3 py-2.5">Số tiền</th><th className="px-3 py-2.5">Bằng chứng</th><th className="px-3 py-2.5">Trạng thái</th></tr></thead><tbody>{visibleDisbursements.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-inkSoft">Chưa có hồ sơ nào được hậu kiểm.</td></tr> : visibleDisbursements.map((disbursement) => <tr key={disbursement.id} className="border-t border-line"><td className="px-3 py-2.5 text-xs text-inkSoft">{fmtDate(disbursement.post_audited_at)}</td><td className="px-3 py-2.5 font-semibold text-chamDeep">{firstRelated(disbursement.campaigns)?.title ?? "—"}</td><td className="px-3 py-2.5 font-mono font-bold text-son">{amount(disbursement.amount)}</td><td className="px-3 py-2.5 text-xs font-bold text-lua">✓ {disbursement.evidence_paths.length} tệp</td><td className="px-3 py-2.5"><Pill status={disbursement.post_audit_status} /></td></tr>)}</tbody></table></div>}
        </section> : null}

        {panel === "sos" ? <section>
          <h1 className="mb-5 font-serif text-[21px] font-medium text-chamDeep">Quản lý SOS Reports</h1>
          <div className="mb-4 rounded-[8px] border border-line bg-white p-4"><div className="mb-3 text-sm font-bold text-chamDeep">Hồ sơ hoạt động cứu trợ chờ duyệt ({pendingRescue})</div>{pendingRescue === 0 ? <p className="text-sm text-inkSoft">Không có hồ sơ nào đang chờ.</p> : <div className="space-y-3">{rescueApplications.filter((application) => application.status === "pending").map((application) => <div key={application.id} className="flex flex-wrap items-center gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0"><div className="min-w-[220px] flex-1"><strong className="text-chamDeep">{application.team_name || application.contact_name}</strong><div className="text-xs text-inkSoft">{application.resource_types.join(" · ") || "Chưa khai báo"} · {application.province ?? "Chưa rõ địa bàn"} · bán kính {application.radius_km ?? "—"}km</div><div className="mt-0.5 text-xs text-inkSoft">{application.contact_email}{application.contact_phone ? ` · ${application.contact_phone}` : ""}</div></div><form className="flex items-center gap-2"><button formAction={approveRescueApplication.bind(null, application.id)} className="rounded-[4px] bg-lua px-3 py-1.5 text-xs font-bold text-white">Duyệt{application.submitted_by ? " & kích hoạt" : ""}</button><button formAction={rejectRescueApplication.bind(null, application.id)} className="rounded-[4px] bg-son/15 px-3 py-1.5 text-xs font-bold text-son">Từ chối</button></form></div>)}</div>}</div>
          <div className="overflow-x-auto rounded-[8px] border border-line bg-white"><div className="border-b border-line px-4 py-3.5 text-sm font-bold text-chamDeep">Điểm SOS thực địa ({unhandledSos} chưa xử lý)</div><table className="w-full min-w-[750px] text-[13px]"><thead className="bg-paper text-left text-[11px] font-bold uppercase tracking-[0.04em] text-inkMid"><tr><th className="px-3 py-2.5">Vị trí</th><th className="px-3 py-2.5">Tình trạng</th><th className="px-3 py-2.5">Nhu cầu</th><th className="px-3 py-2.5">Liên hệ</th><th className="px-3 py-2.5">Thao tác</th></tr></thead><tbody>{sosReports.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-inkSoft">Chưa có báo cáo SOS nào.</td></tr> : sosReports.map((report) => <tr key={report.id} className="border-t border-line"><td className="px-3 py-2.5"><strong className="text-chamDeep">{report.location_text}</strong><div className="text-xs text-inkSoft">{fmtDate(report.created_at)}</div></td><td className="px-3 py-2.5"><Pill status={report.status} /></td><td className="px-3 py-2.5 text-inkMid">{report.needs.join(", ") || "—"}</td><td className="px-3 py-2.5 text-xs text-inkMid">{report.contact_phone ?? "—"}</td><td className="px-3 py-2.5">{report.status !== "handled" ? <form><button formAction={markSosHandled.bind(null, report.id)} className="rounded-[4px] bg-lua px-3 py-1.5 text-xs font-bold text-white">Đánh dấu đã xử lý</button></form> : <span className="text-xs text-inkSoft">—</span>}</td></tr>)}</tbody></table></div>
        </section> : null}
      </main>
    </div>
  );
}
