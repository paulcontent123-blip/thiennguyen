"use client";

import { useMemo, useState } from "react";
import {
  approveCampaign,
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

type Campaign = {
  id: string;
  title: string;
  campaign_type: "direct" | "partner";
  target_amount: number;
  status: string;
  submitted_at: string | null;
  created_at: string;
  organizations: { name: string }[] | null;
};

type Organization = {
  id: string;
  name: string;
  legal_representative_name: string;
  license_status: string;
  license_number: string | null;
  license_note: string | null;
  created_at: string;
};

type Disbursement = {
  id: string;
  amount: number;
  description: string;
  status: string;
  evidence_paths: string[];
  submitted_at: string | null;
  representative_approved_at: string | null;
  post_audit_status: string;
  post_audited_at: string | null;
  post_audit_note: string | null;
  campaigns: { title: string }[] | null;
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

const currency = new Intl.NumberFormat("vi-VN");
const datetime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function fmtDate(value: string | null) {
  return value ? datetime.format(new Date(value)) : "—";
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
  const s = statusPill[status] ?? { label: status, className: "bg-inkSoft/15 text-inkSoft" };
  return <span className={`rounded-[4px] px-2 py-0.5 text-xs font-bold ${s.className}`}>{s.label}</span>;
}

function ReviewActions({
  approveAction,
  reviseAction,
  rejectAction,
  reviseLabel = "Cần bổ sung",
}: {
  approveAction: (formData: FormData) => void;
  reviseAction?: (formData: FormData) => void;
  rejectAction: (formData: FormData) => void;
  reviseLabel?: string;
}) {
  return (
    <form className="flex flex-wrap items-center gap-2">
      {reviseAction ? (
        <input name="note" placeholder="Ghi chú (nếu cần bổ sung/từ chối)" className="w-40 rounded-[4px] border border-line px-2 py-1 text-xs" />
      ) : null}
      <button formAction={approveAction} className="rounded-[4px] bg-lua px-3 py-1.5 text-xs font-bold text-white">
        Duyệt
      </button>
      {reviseAction ? (
        <button formAction={reviseAction} className="rounded-[4px] bg-sky/15 px-3 py-1.5 text-xs font-bold text-sky">
          {reviseLabel}
        </button>
      ) : null}
      <button formAction={rejectAction} className="rounded-[4px] bg-son/15 px-3 py-1.5 text-xs font-bold text-son">
        Từ chối
      </button>
    </form>
  );
}

export function AdminPortal({
  campaigns,
  organizations,
  disbursements,
  rescueApplications,
  sosReports,
}: {
  campaigns: Campaign[];
  organizations: Organization[];
  disbursements: Disbursement[];
  rescueApplications: RescueApplication[];
  sosReports: SosReport[];
}) {
  const [panel, setPanel] = useState<Panel>("overview");
  const [campaignFilter, setCampaignFilter] = useState<"all" | "pending_review" | "needs_revision" | "approved">("all");

  const pendingCampaigns = campaigns.filter((c) => c.status === "pending_review").length;
  const pendingOrgs = organizations.filter((o) => o.license_status === "pending").length;
  const pendingRescue = rescueApplications.filter((r) => r.status === "pending").length;
  const unhandledSos = sosReports.filter((s) => s.status !== "handled").length;

  const filteredCampaigns = useMemo(() => {
    if (campaignFilter === "all") return campaigns;
    if (campaignFilter === "approved") return campaigns.filter((c) => ["approved", "active", "closed"].includes(c.status));
    return campaigns.filter((c) => c.status === campaignFilter);
  }, [campaigns, campaignFilter]);

  const pendingDisbursements = disbursements.filter((d) => d.status === "representative_approved" && d.post_audit_status === "not_reviewed");
  const auditedDisbursements = disbursements.filter((d) => d.post_audit_status !== "not_reviewed").slice(0, 5);

  const recentActivity = useMemo(() => {
    const items: { time: string; icon: string; label: string; detail: string; status: string }[] = [];
    campaigns.slice(0, 5).forEach((c) =>
      items.push({ time: c.created_at, icon: "\u{1F3AF}", label: "Chiến dịch", detail: `${c.title} · ${c.organizations?.[0]?.name ?? ""}`, status: c.status })
    );
    organizations.slice(0, 5).forEach((o) =>
      items.push({ time: o.created_at, icon: "\u{1F3DB}", label: "KYC", detail: o.name, status: o.license_status })
    );
    rescueApplications.slice(0, 5).forEach((r) =>
      items.push({ time: r.created_at, icon: "\u{1F691}", label: "Cứu trợ", detail: r.team_name ?? r.contact_name, status: r.status })
    );
    sosReports.slice(0, 5).forEach((s) => items.push({ time: s.created_at, icon: "\u{1F6A8}", label: "SOS", detail: s.location_text, status: s.status }));
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);
  }, [campaigns, organizations, rescueApplications, sosReports]);

  const navItems: { key: Panel; icon: string; label: string }[] = [
    { key: "overview", icon: "\u{1F4CA}", label: "Tổng quan" },
    { key: "campaigns", icon: "\u{1F3AF}", label: "Duyệt chiến dịch" },
    { key: "kyc", icon: "\u{1F4CB}", label: "Xác minh giấy phép" },
    { key: "disbursement", icon: "\u{1F4B0}", label: "Hậu kiểm giải ngân" },
    { key: "sos", icon: "\u{1F4CD}", label: "SOS Reports" },
  ];

  return (
    <div className="flex min-h-screen bg-paperMid">
      <aside className="w-[220px] shrink-0 bg-chamDeep py-6 text-white">
        <div className="px-5 pb-6 font-serif text-base font-semibold leading-tight">
          Thiện Nguyện
          <br />
          <strong className="text-sm text-white/70">Admin Portal</strong>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setPanel(item.key)}
              className={`flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left text-sm font-semibold transition ${
                panel === item.key ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="w-[18px] text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-6 border-t border-white/10 px-3 pt-4">
          <a href="/" className="flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-sm font-semibold text-white/65 hover:text-white">
            <span className="w-[18px] text-center">&#8592;</span>
            Về trang chủ
          </a>
        </div>
      </aside>

      <main className="flex-1 p-8">
        {panel === "overview" ? (
          <div>
            <h1 className="font-serif text-2xl font-semibold text-chamDeep">Tổng quan hệ thống</h1>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Chiến dịch chờ duyệt", pendingCampaigns],
                ["Tổ chức chờ KYC", pendingOrgs],
                ["Hồ sơ cứu trợ chờ duyệt", pendingRescue],
                ["SOS chưa xử lý", unhandledSos],
              ].map(([label, n]) => (
                <div key={label as string} className="panel">
                  <div className="font-mono text-2xl font-bold text-chamDeep">{n}</div>
                  <div className="mt-1 text-xs font-semibold text-inkSoft">{label}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button onClick={() => setPanel("campaigns")} className="panel border-l-4 border-l-son text-left">
                <div className="text-xl">&#127919;</div>
                <div className="mt-1 text-sm font-bold text-chamDeep">{pendingCampaigns} chiến dịch</div>
                <div className="text-xs text-inkMid">đang chờ duyệt</div>
              </button>
              <button onClick={() => setPanel("disbursement")} className="panel border-l-4 border-l-nghe text-left">
                <div className="text-xl">&#128176;</div>
                <div className="mt-1 text-sm font-bold text-chamDeep">{pendingDisbursements.length} hồ sơ</div>
                <div className="text-xs text-inkMid">chờ hậu kiểm giải ngân</div>
              </button>
              <button onClick={() => setPanel("kyc")} className="panel border-l-4 border-l-sky text-left">
                <div className="text-xl">&#128203;</div>
                <div className="mt-1 text-sm font-bold text-chamDeep">{pendingOrgs} tổ chức</div>
                <div className="text-xs text-inkMid">chờ xác minh giấy phép</div>
              </button>
            </div>

            <div className="panel mt-6 overflow-hidden !p-0">
              <div className="border-b border-line px-4 py-3 text-sm font-bold text-chamDeep">Hoạt động gần đây</div>
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs font-bold uppercase text-inkSoft">
                  <tr>
                    <th className="px-4 py-2">Thời gian</th>
                    <th className="px-4 py-2">Sự kiện</th>
                    <th className="px-4 py-2">Chi tiết</th>
                    <th className="px-4 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-inkSoft">
                        Chưa có hoạt động nào.
                      </td>
                    </tr>
                  ) : (
                    recentActivity.map((a, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="px-4 py-2.5 text-xs text-inkSoft">{fmtDate(a.time)}</td>
                        <td className="px-4 py-2.5">
                          {a.icon} {a.label}
                        </td>
                        <td className="px-4 py-2.5 text-inkMid">{a.detail}</td>
                        <td className="px-4 py-2.5">
                          <Pill status={a.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {panel === "campaigns" ? (
          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-serif text-2xl font-semibold text-chamDeep">Duyệt Chiến dịch</h1>
              <div className="flex flex-wrap gap-2">
                {[
                  ["all", `Tất cả (${campaigns.length})`],
                  ["pending_review", `Chờ duyệt (${campaigns.filter((c) => c.status === "pending_review").length})`],
                  ["needs_revision", `Cần bổ sung (${campaigns.filter((c) => c.status === "needs_revision").length})`],
                  ["approved", `Đã duyệt (${campaigns.filter((c) => ["approved", "active", "closed"].includes(c.status)).length})`],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setCampaignFilter(value as typeof campaignFilter)}
                    className={`rounded-[40px] border px-3 py-1.5 text-xs font-bold ${
                      campaignFilter === value ? "border-son text-son" : "border-line text-inkMid"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel overflow-x-auto !p-0">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs font-bold uppercase text-inkSoft">
                  <tr>
                    <th className="px-4 py-2">Chiến dịch</th>
                    <th className="px-4 py-2">Tổ chức</th>
                    <th className="px-4 py-2">Loại</th>
                    <th className="px-4 py-2">Mục tiêu</th>
                    <th className="px-4 py-2">Ngày gửi</th>
                    <th className="px-4 py-2">Trạng thái</th>
                    <th className="px-4 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-inkSoft">
                        Không có chiến dịch nào.
                      </td>
                    </tr>
                  ) : (
                    filteredCampaigns.map((c) => (
                      <tr key={c.id} className="border-t border-line align-top">
                        <td className="px-4 py-3 font-semibold text-chamDeep">{c.title}</td>
                        <td className="px-4 py-3 text-inkMid">{c.organizations?.[0]?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-inkMid">{c.campaign_type === "direct" ? "Trực tiếp" : "Kết nối"}</td>
                        <td className="px-4 py-3 font-mono font-bold text-son">{currency.format(c.target_amount)}đ</td>
                        <td className="px-4 py-3 text-xs text-inkSoft">{fmtDate(c.submitted_at ?? c.created_at)}</td>
                        <td className="px-4 py-3">
                          <Pill status={c.status} />
                        </td>
                        <td className="px-4 py-3">
                          {c.status === "pending_review" || c.status === "needs_revision" ? (
                            <ReviewActions
                              approveAction={approveCampaign.bind(null, c.id)}
                              reviseAction={requestCampaignRevision.bind(null, c.id)}
                              rejectAction={rejectCampaign.bind(null, c.id)}
                            />
                          ) : (
                            <span className="text-xs text-inkSoft">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {panel === "kyc" ? (
          <div>
            <h1 className="mb-5 font-serif text-2xl font-semibold text-chamDeep">Xác minh giấy phép tổ chức</h1>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {organizations.length === 0 ? (
                <p className="text-sm text-inkSoft">Chưa có tổ chức nào đăng ký.</p>
              ) : (
                organizations.map((o) => (
                  <div key={o.id} className="panel">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-serif text-base font-semibold text-chamDeep">{o.name}</div>
                      <Pill status={o.license_status} />
                    </div>
                    <div className="mt-1 text-xs text-inkSoft">Người đại diện: {o.legal_representative_name}</div>
                    {o.license_number ? <div className="mt-1 text-xs text-inkSoft">Số giấy phép: {o.license_number}</div> : null}
                    {o.license_note ? <div className="mt-2 rounded-[4px] bg-paper p-2 text-xs text-inkMid">Ghi chú: {o.license_note}</div> : null}
                    {o.license_status === "pending" || o.license_status === "needs_revision" ? (
                      <div className="mt-3">
                        <ReviewActions
                          approveAction={approveOrganization.bind(null, o.id)}
                          reviseAction={requestOrganizationRevision.bind(null, o.id)}
                          rejectAction={rejectOrganization.bind(null, o.id)}
                        />
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {panel === "disbursement" ? (
          <div>
            <h1 className="mb-5 font-serif text-2xl font-semibold text-chamDeep">Hậu kiểm Bằng chứng Giải ngân</h1>

            <div className="panel mb-3 !p-0">
              <div className="border-b border-line px-4 py-3 text-sm font-bold text-chamDeep">Hồ sơ chờ hậu kiểm ({pendingDisbursements.length})</div>
              {pendingDisbursements.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-inkSoft">Không có hồ sơ nào đang chờ hậu kiểm.</p>
              ) : (
                <div className="divide-y divide-line">
                  {pendingDisbursements.map((d) => (
                    <div key={d.id} className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-chamDeep">{d.campaigns?.[0]?.title ?? "—"}</div>
                          <div className="font-mono font-bold text-son">{currency.format(d.amount)}đ</div>
                        </div>
                        <div className="text-xs text-inkSoft">Người đại diện ký lúc: {fmtDate(d.representative_approved_at)}</div>
                      </div>
                      <p className="mt-2 text-sm text-inkMid">{d.description}</p>
                      <div className="mt-1 text-xs text-inkSoft">{d.evidence_paths.length} tệp bằng chứng đính kèm</div>
                      <form className="mt-3 flex flex-wrap items-center gap-2">
                        <input name="note" placeholder="Ghi chú hậu kiểm" className="w-48 rounded-[4px] border border-line px-2 py-1 text-xs" />
                        <button formAction={postAuditDisbursement.bind(null, d.id, "valid")} className="rounded-[4px] bg-lua px-3 py-1.5 text-xs font-bold text-white">
                          &#9989; Hậu kiểm hợp lệ
                        </button>
                        <button
                          formAction={postAuditDisbursement.bind(null, d.id, "needs_explanation")}
                          className="rounded-[4px] bg-sky/15 px-3 py-1.5 text-xs font-bold text-sky"
                        >
                          Yêu cầu giải trình
                        </button>
                        <button
                          formAction={postAuditDisbursement.bind(null, d.id, "violation")}
                          className="rounded-[4px] bg-son/15 px-3 py-1.5 text-xs font-bold text-son"
                        >
                          Đánh dấu vi phạm
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel !p-0">
              <div className="border-b border-line px-4 py-3 text-sm font-bold text-chamDeep">Đã hậu kiểm gần đây</div>
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs font-bold uppercase text-inkSoft">
                  <tr>
                    <th className="px-4 py-2">Chiến dịch</th>
                    <th className="px-4 py-2">Số tiền</th>
                    <th className="px-4 py-2">Hậu kiểm lúc</th>
                    <th className="px-4 py-2">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {auditedDisbursements.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-inkSoft">
                        Chưa có hồ sơ nào được hậu kiểm.
                      </td>
                    </tr>
                  ) : (
                    auditedDisbursements.map((d) => (
                      <tr key={d.id} className="border-t border-line">
                        <td className="px-4 py-2.5 font-semibold text-chamDeep">{d.campaigns?.[0]?.title ?? "—"}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-son">{currency.format(d.amount)}đ</td>
                        <td className="px-4 py-2.5 text-xs text-inkSoft">{fmtDate(d.post_audited_at)}</td>
                        <td className="px-4 py-2.5">
                          <Pill status={d.post_audit_status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {panel === "sos" ? (
          <div>
            <h1 className="mb-5 font-serif text-2xl font-semibold text-chamDeep">Quản lý SOS Reports</h1>

            <div className="panel mb-6">
              <div className="mb-3 text-sm font-bold text-chamDeep">Hồ sơ đăng ký đội cứu trợ chờ duyệt ({rescueApplications.filter((r) => r.status === "pending").length})</div>
              {rescueApplications.filter((r) => r.status === "pending").length === 0 ? (
                <p className="text-sm text-inkSoft">Không có hồ sơ nào đang chờ.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {rescueApplications
                    .filter((r) => r.status === "pending")
                    .map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0">
                        <div className="min-w-[220px] flex-1">
                          <strong className="text-chamDeep">{r.team_name || r.contact_name}</strong>
                          <div className="text-xs text-inkSoft">
                            {r.resource_types.join(", ") || "—"} · {r.province ?? "—"} · bán kính {r.radius_km ?? "—"}km
                          </div>
                          <div className="mt-0.5 text-xs text-inkSoft">
                            {r.submitted_by ? (
                              "Đã có tài khoản — duyệt sẽ kích hoạt ngay."
                            ) : (
                              <span className="text-nghe-deep">
                                Nộp ẩn danh — duyệt chỉ đánh dấu hồ sơ, chưa kích hoạt được (cần tính năng mời qua email, chưa triển khai).
                              </span>
                            )}
                          </div>
                        </div>
                        <form className="flex items-center gap-2">
                          <input name="note" placeholder="Ghi chú" className="w-32 rounded-[4px] border border-line px-2 py-1 text-xs" />
                          <button formAction={approveRescueApplication.bind(null, r.id)} className="rounded-[4px] bg-lua px-3 py-1.5 text-xs font-bold text-white">
                            Duyệt{r.submitted_by ? " & kích hoạt" : ""}
                          </button>
                          <button formAction={rejectRescueApplication.bind(null, r.id)} className="rounded-[4px] bg-son/15 px-3 py-1.5 text-xs font-bold text-son">
                            Từ chối
                          </button>
                        </form>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="panel !p-0">
              <div className="border-b border-line px-4 py-3 text-sm font-bold text-chamDeep">Điểm SOS thực địa ({sosReports.filter((s) => s.status !== "handled").length} chưa xử lý)</div>
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs font-bold uppercase text-inkSoft">
                  <tr>
                    <th className="px-4 py-2">Vị trí</th>
                    <th className="px-4 py-2">Tình trạng</th>
                    <th className="px-4 py-2">Nhu cầu</th>
                    <th className="px-4 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sosReports.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-inkSoft">
                        Chưa có báo cáo SOS nào (trang báo SOS công khai chưa được xây ở đợt này).
                      </td>
                    </tr>
                  ) : (
                    sosReports.map((s) => (
                      <tr key={s.id} className="border-t border-line">
                        <td className="px-4 py-2.5">
                          <strong className="text-chamDeep">{s.location_text}</strong>
                          <div className="text-xs text-inkSoft">{fmtDate(s.created_at)}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Pill status={s.status} />
                        </td>
                        <td className="px-4 py-2.5 text-inkMid">{s.needs.join(", ") || "—"}</td>
                        <td className="px-4 py-2.5">
                          {s.status !== "handled" ? (
                            <form>
                              <button formAction={markSosHandled.bind(null, s.id)} className="rounded-[4px] bg-lua px-3 py-1.5 text-xs font-bold text-white">
                                Đánh dấu đã xử lý
                              </button>
                            </form>
                          ) : (
                            <span className="text-xs text-inkSoft">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
