import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignContentManager } from "@/components/organization/campaign-content-manager";
import { SiteHeader } from "@/components/site-header";
import { requirePageRole } from "@/lib/auth/server";
import type { CampaignMedia, CampaignPaymentConfig, CampaignSeo, CampaignShareSettings, CampaignUpdate } from "@/lib/campaigns/content";

type Campaign = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  campaign_type: string;
  category: string | null;
  target_amount: number | string;
  deadline: string | null;
  status: string;
  review_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type CampaignHistory = {
  id: number;
  from_status: string | null;
  to_status: string;
  actor_name: string;
  actor_role: string | null;
  note: string | null;
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
  created_at: string;
};

type DonationTransaction = {
  id: string;
  tx_ref: string;
  amount_vnd: number | string;
  status: string;
  expires_at: string;
  completed_at: string | null;
  created_at: string;
};

const campaignStatus: Record<string, { label: string; className: string }> = {
  draft: { label: "Bản nháp", className: "bg-inkSoft/15 text-inkSoft" },
  pending_review: { label: "Chờ duyệt", className: "bg-nghe/15 text-ngheDeep" },
  needs_revision: { label: "Cần chỉnh sửa", className: "bg-sky/15 text-sky" },
  approved: { label: "Đã duyệt", className: "bg-lua/15 text-lua" },
  active: { label: "Đang hoạt động", className: "bg-lua/15 text-lua" },
  closed: { label: "Đã đóng", className: "bg-inkSoft/15 text-inkSoft" },
  rejected: { label: "Từ chối", className: "bg-son/15 text-son" },
};

const disbursementStatus: Record<string, string> = {
  draft: "Bản nháp",
  submitted: "Đã gửi",
  representative_approved: "Đại diện đã duyệt",
  recorded: "Đã ghi nhận",
  published: "Đã công khai",
};

const auditStatus: Record<string, string> = {
  not_reviewed: "Chưa hậu kiểm",
  valid: "Hợp lệ",
  needs_explanation: "Cần giải trình",
  violation: "Có dấu hiệu vi phạm",
};

const transactionStatus: Record<string, { label: string; className: string }> = {
  pending: { label: "Chờ xác nhận", className: "bg-nghe/15 text-ngheDeep" },
  completed: { label: "Thành công", className: "bg-lua/15 text-lua" },
  needs_review: { label: "Cần đối soát", className: "bg-sky/15 text-sky" },
  failed: { label: "Thất bại", className: "bg-son/15 text-son" },
  expired: { label: "Hết hạn", className: "bg-inkSoft/15 text-inkSoft" },
  refunded: { label: "Đã hoàn tiền", className: "bg-paperDeep text-inkMid" },
};

const currency = new Intl.NumberFormat("vi-VN");
const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: string | null) {
  return value ? date.format(new Date(value)) : "Chưa cập nhật";
}

function formatDateTime(value: string | null) {
  return value ? dateTime.format(new Date(value)) : "Chưa cập nhật";
}

function StatusPill({ status }: { status: string }) {
  const item = campaignStatus[status] ?? { label: status, className: "bg-inkSoft/15 text-inkSoft" };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${item.className}`}>{item.label}</span>;
}

export default async function OrganizationCampaignDetailPage({ params }: { params: { id: string } }) {
  const pathname = `/organization/campaigns/${params.id}`;
  const { supabase, user } = await requirePageRole(["org"], pathname);

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (organizationError || !organization) notFound();

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, title, slug, summary, description, campaign_type, category, target_amount, deadline, status, review_note, submitted_at, reviewed_at, published_at, created_at, updated_at")
    .eq("id", params.id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) notFound();

  const [
    { data: history, error: historyError },
    { data: disbursements, error: disbursementError },
    { data: media, error: mediaError },
    { data: updates, error: updatesError },
    { data: paymentConfig, error: paymentError },
    { data: seo, error: seoError },
    { data: shareSettings, error: shareError },
    { data: transactions, error: transactionError },
  ] = await Promise.all([
    supabase
      .from("campaign_status_history")
      .select("id, from_status, to_status, actor_name, actor_role, note, created_at")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("disbursements")
      .select("id, amount, description, status, evidence_paths, submitted_at, representative_approved_at, post_audit_status, post_audited_at, post_audit_note, created_at")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("campaign_media")
      .select("id, campaign_id, update_id, media_type, slot, provider, title, alt_text, url, public_id, thumbnail_url, sort_order, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("campaign_updates")
      .select("id, campaign_id, update_type, title, body, location_text, event_at, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .order("event_at", { ascending: false }),
    supabase
      .from("campaign_payment_configs")
      .select("campaign_id, provider, bank_id, account_no, account_name, description_template, is_active, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .maybeSingle(),
    supabase
      .from("campaign_seo")
      .select("campaign_id, meta_title, meta_description, canonical_url, schema_type, schema_json, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .maybeSingle(),
    supabase
      .from("campaign_share_settings")
      .select("campaign_id, zalo_enabled, facebook_enabled, copy_enabled, share_title, share_description, share_image_url, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("id, tx_ref, amount_vnd, status, expires_at, completed_at, created_at")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (historyError) throw new Error(historyError.message);
  if (disbursementError) throw new Error(disbursementError.message);
  if (mediaError) throw new Error(mediaError.message);
  if (updatesError) throw new Error(updatesError.message);
  if (paymentError) throw new Error(paymentError.message);
  if (seoError) throw new Error(seoError.message);
  if (shareError) throw new Error(shareError.message);
  if (transactionError) console.warn("Organization transaction list is unavailable", { campaignId: campaign.id, code: transactionError.code });

  const typedCampaign = campaign as Campaign;
  const typedHistory = (history ?? []) as CampaignHistory[];
  const typedDisbursements = (disbursements ?? []) as Disbursement[];
  const typedMedia = (media ?? []) as CampaignMedia[];
  const typedUpdates = (updates ?? []) as CampaignUpdate[];
  const typedPaymentConfig = (paymentConfig ?? null) as CampaignPaymentConfig | null;
  const typedSeo = (seo ?? null) as CampaignSeo | null;
  const typedShareSettings = (shareSettings ?? null) as CampaignShareSettings | null;
  const typedTransactions = (transactions ?? []) as DonationTransaction[];
  const totalDisbursement = typedDisbursements.reduce((total, item) => total + Number(item.amount || 0), 0);
  const totalReceived = typedTransactions
    .filter((item) => item.status === "completed")
    .reduce((total, item) => total + Number(item.amount_vnd || 0), 0);
  const pendingTransactions = typedTransactions.filter((item) => item.status === "pending").length;

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-[1160px] px-7 py-8">
        <Link href="/organization" className="text-sm font-bold text-sky hover:underline">
          ← Quay lại cổng tổ chức
        </Link>

        <div className="mt-5 rounded-[12px] border border-line bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Chi tiết chiến dịch</p>
              <h1 className="mt-2 max-w-3xl font-serif text-3xl font-semibold text-chamDeep">{typedCampaign.title}</h1>
              <p className="mt-2 text-sm text-inkSoft">Tổ chức: {organization.name}</p>
            </div>
            <StatusPill status={typedCampaign.status} />
          </div>
          {typedCampaign.review_note ? (
            <div className="mt-5 rounded-[8px] border border-son/20 bg-son/10 px-4 py-3 text-sm text-son">
              <strong>Phản hồi của Admin:</strong> {typedCampaign.review_note}
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <InfoCard label="Mục tiêu" value={`${currency.format(Number(typedCampaign.target_amount) || 0)}đ`} />
          <InfoCard label="Đã xác nhận" value={`${currency.format(totalReceived)}đ`} />
          <InfoCard label="Giao dịch chờ" value={String(pendingTransactions)} />
          <InfoCard label="Loại chiến dịch" value={typedCampaign.campaign_type === "direct" ? "Trực tiếp" : "Kết nối"} />
          <InfoCard label="Thời hạn" value={typedCampaign.deadline ? formatDate(typedCampaign.deadline) : "Không giới hạn"} />
          <InfoCard label="Tổng hồ sơ giải ngân" value={`${currency.format(totalDisbursement)}đ`} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
          <div className="space-y-6">
            <section className="rounded-[12px] border border-line bg-white p-6">
              <h2 className="font-serif text-xl font-semibold text-chamDeep">Nội dung chiến dịch</h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-inkMid">{typedCampaign.description || typedCampaign.summary || "Chưa có mô tả."}</p>
              {typedCampaign.category ? <p className="mt-5 text-xs font-bold uppercase tracking-wide text-inkSoft">Hạng mục: {typedCampaign.category}</p> : null}
            </section>

            <section className="rounded-[12px] border border-line bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-serif text-xl font-semibold text-chamDeep">Lịch sử trạng thái</h2>
                <span className="text-xs text-inkSoft">{typedHistory.length} lần cập nhật</span>
              </div>
              {typedHistory.length === 0 ? (
                <p className="mt-5 text-sm text-inkSoft">Chưa có lịch sử trạng thái.</p>
              ) : (
                <ol className="mt-5 space-y-4 border-l border-line pl-5">
                  {typedHistory.map((event) => (
                    <li key={event.id} className="relative">
                      <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-sky" />
                      <p className="font-semibold text-chamDeep">
                        {event.from_status ? `${campaignStatus[event.from_status]?.label ?? event.from_status} → ` : "Khởi tạo → "}
                        {campaignStatus[event.to_status]?.label ?? event.to_status}
                      </p>
                      <p className="mt-1 text-xs text-inkSoft">
                        {event.actor_name} ({event.actor_role ?? "system"}) · {formatDateTime(event.created_at)}
                      </p>
                      {event.note ? <p className="mt-1 text-sm text-son">{event.note}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-[12px] border border-line bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-serif text-xl font-semibold text-chamDeep">Giao dịch ủng hộ</h2>
                <span className="text-xs text-inkSoft">{typedTransactions.length} giao dịch gần nhất</span>
              </div>
              {typedTransactions.length === 0 ? (
                <p className="mt-5 text-sm text-inkSoft">Chưa có giao dịch nào được tạo cho chiến dịch này.</p>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                    <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-inkSoft"><th className="px-2 py-2">Mã</th><th className="px-2 py-2 text-right">Số tiền</th><th className="px-2 py-2">Trạng thái</th><th className="px-2 py-2">Thời gian</th></tr></thead>
                    <tbody>
                      {typedTransactions.map((item) => {
                        const status = transactionStatus[item.status] ?? { label: item.status, className: "bg-paperDeep text-inkMid" };
                        return <tr key={item.id} className="border-b border-line/70 last:border-0"><td className="px-2 py-3 font-mono text-xs font-bold text-chamDeep">{item.tx_ref}</td><td className="px-2 py-3 text-right font-mono font-bold text-son">{currency.format(Number(item.amount_vnd) || 0)}đ</td><td className="px-2 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span></td><td className="px-2 py-3 text-xs text-inkSoft">{formatDateTime(item.completed_at ?? item.created_at)}</td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-[12px] border border-line bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-serif text-xl font-semibold text-chamDeep">Hồ sơ giải ngân</h2>
                <span className="text-xs text-inkSoft">{typedDisbursements.length} hồ sơ</span>
              </div>
              {typedDisbursements.length === 0 ? (
                <p className="mt-5 text-sm text-inkSoft">Chưa có hồ sơ giải ngân cho chiến dịch này.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {typedDisbursements.map((item) => (
                    <article key={item.id} className="rounded-[8px] border border-line bg-paper p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono font-bold text-son">{currency.format(Number(item.amount) || 0)}đ</p>
                          <p className="mt-1 text-sm text-inkMid">{item.description}</p>
                        </div>
                        <span className="rounded-full bg-sky/10 px-2.5 py-1 text-xs font-bold text-sky">
                          {disbursementStatus[item.status] ?? item.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-inkSoft sm:grid-cols-2">
                        <span>Tạo: {formatDateTime(item.created_at)}</span>
                        <span>Đại diện duyệt: {formatDateTime(item.representative_approved_at)}</span>
                        <span>Bằng chứng: {item.evidence_paths?.length ?? 0} tệp</span>
                        <span>Hậu kiểm: {auditStatus[item.post_audit_status] ?? item.post_audit_status}</span>
                      </div>
                      {item.post_audit_note ? <p className="mt-3 text-xs text-son">Ghi chú hậu kiểm: {item.post_audit_note}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="h-fit rounded-[12px] border border-line bg-white p-6">
            <h2 className="font-serif text-xl font-semibold text-chamDeep">Thông tin quản lý</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <DetailRow label="Ngày tạo" value={formatDateTime(typedCampaign.created_at)} />
              <DetailRow label="Cập nhật gần nhất" value={formatDateTime(typedCampaign.updated_at)} />
              <DetailRow label="Gửi duyệt" value={formatDateTime(typedCampaign.submitted_at)} />
              <DetailRow label="Admin xử lý" value={formatDateTime(typedCampaign.reviewed_at)} />
              <DetailRow label="Công khai" value={formatDateTime(typedCampaign.published_at)} />
              <DetailRow label="Slug" value={typedCampaign.slug} />
            </dl>
            <div className="mt-6 border-t border-line pt-5">
              <Link href="/organization" className="inline-flex rounded-[8px] border border-lineStrong px-4 py-2 text-sm font-bold text-chamDeep hover:border-son hover:text-son">
                Quản lý chiến dịch
              </Link>
              {['draft', 'needs_revision'].includes(typedCampaign.status) ? (
                <p className="mt-3 text-xs leading-5 text-inkSoft">Bạn có thể chỉnh sửa nội dung tại bảng chiến dịch trong cổng tổ chức.</p>
              ) : (
                <p className="mt-3 text-xs leading-5 text-inkSoft">Nội dung đã gửi duyệt được khóa chỉnh sửa theo trạng thái hiện tại.</p>
              )}
            </div>
          </aside>
        </div>

        <CampaignContentManager
          campaignId={typedCampaign.id}
          media={typedMedia}
          updates={typedUpdates}
          paymentConfig={typedPaymentConfig}
          seo={typedSeo}
          shareSettings={typedShareSettings}
        />
      </section>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-inkSoft">{label}</p>
      <p className="mt-2 font-semibold text-chamDeep">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
      <dt className="text-inkSoft">{label}</dt>
      <dd className="max-w-[62%] break-words text-right font-semibold text-chamDeep">{value}</dd>
    </div>
  );
}
