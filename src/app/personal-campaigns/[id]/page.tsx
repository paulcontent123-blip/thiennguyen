import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignContentManager } from "@/components/organization/campaign-content-manager";
import { SiteHeader } from "@/components/site-header";
import { requirePageRole } from "@/lib/auth/server";
import type { CampaignMedia, CampaignSeo, CampaignShareSettings, CampaignUpdate } from "@/lib/campaigns/content";

type PersonalCampaign = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  campaign_type: string;
  category: string | null;
  province: string | null;
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

type DonationTransaction = {
  id: string;
  tx_ref: string;
  amount_vnd: number | string;
  payment_provider: string;
  status: string;
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[10px] border border-line bg-white p-4"><p className="text-xs text-inkSoft">{label}</p><p className="mt-1 font-serif text-lg font-semibold text-chamDeep">{value}</p></div>;
}

export default async function PersonalCampaignDetailPage({ params }: { params: { id: string } }) {
  const pathname = `/personal-campaigns/${params.id}`;
  const { supabase, user } = await requirePageRole(["donor"], pathname);

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, title, slug, summary, description, campaign_type, category, province, target_amount, deadline, status, review_note, submitted_at, reviewed_at, published_at, created_at, updated_at")
    .eq("id", params.id)
    .eq("owner_type", "individual")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) notFound();

  const [historyResult, transactionsResult, mediaResult, updatesResult, seoResult, shareResult] = await Promise.all([
    supabase
      .from("campaign_status_history")
      .select("id, from_status, to_status, actor_name, actor_role, note, created_at")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("id, tx_ref, amount_vnd, payment_provider, status, completed_at, created_at")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false })
      .limit(100),
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
      .from("campaign_seo")
      .select("campaign_id, meta_title, meta_description, canonical_url, schema_type, schema_json, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .maybeSingle(),
    supabase
      .from("campaign_share_settings")
      .select("campaign_id, zalo_enabled, facebook_enabled, copy_enabled, share_title, share_description, share_image_url, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .maybeSingle(),
  ]);

  const firstError = historyResult.error || transactionsResult.error || mediaResult.error || updatesResult.error || seoResult.error || shareResult.error;
  if (firstError) throw new Error(firstError.message);

  const typedCampaign = campaign as PersonalCampaign;
  const history = (historyResult.data ?? []) as CampaignHistory[];
  const transactions = (transactionsResult.data ?? []) as DonationTransaction[];
  const completedTransactions = transactions.filter((item) => item.status === "completed");
  const totalReceived = completedTransactions.reduce((sum, item) => sum + Number(item.amount_vnd || 0), 0);
  const pendingTransactions = transactions.filter((item) => item.status === "pending").length;
  const contentLocked = ["pending_review", "rejected"].includes(typedCampaign.status);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-[1160px] px-6 py-8">
        <Link href="/personal-campaigns" className="text-sm font-bold text-sky hover:underline">← Quay lại chiến dịch cá nhân</Link>

        <div className="mt-5 rounded-[12px] border border-line bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Chi tiết chiến dịch cá nhân</p>
              <h1 className="mt-2 max-w-3xl font-serif text-3xl font-semibold text-chamDeep">{typedCampaign.title}</h1>
              <p className="mt-2 text-sm text-inkSoft">{typedCampaign.category ?? "Chưa phân loại"}{typedCampaign.province ? ` · ${typedCampaign.province}` : ""}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <StatusPill status={typedCampaign.status} />
              {["approved", "active", "closed"].includes(typedCampaign.status) ? <Link href={`/campaigns/${typedCampaign.slug}`} className="rounded-[7px] border border-lineStrong px-3 py-2 text-xs font-bold text-chamDeep hover:border-son hover:text-son">Trang công khai ↗</Link> : null}
              {["active", "closed"].includes(typedCampaign.status) ? <Link href={`/campaign-closure/${typedCampaign.id}`} className="rounded-[7px] border border-son px-3 py-2 text-xs font-bold text-son hover:bg-son hover:text-white">Dashboard tất toán</Link> : null}
            </div>
          </div>
          {typedCampaign.review_note ? <div className="mt-5 rounded-[8px] border border-son/20 bg-son/10 px-4 py-3 text-sm text-son"><strong>Phản hồi của Admin:</strong> {typedCampaign.review_note}</div> : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard label="Mục tiêu" value={`${currency.format(Number(typedCampaign.target_amount) || 0)}đ`} />
          <InfoCard label="Đã xác nhận" value={`${currency.format(totalReceived)}đ`} />
          <InfoCard label="Giao dịch thành công" value={String(completedTransactions.length)} />
          <InfoCard label="Giao dịch chờ" value={String(pendingTransactions)} />
        </div>

        <section className="mt-6 rounded-[12px] border border-line bg-white p-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-inkSoft">Loại chiến dịch</p><p className="mt-1 font-semibold text-chamDeep">{typedCampaign.campaign_type === "direct" ? "Trực tiếp" : "Kết nối"}</p></div>
            <div><p className="text-xs text-inkSoft">Thời hạn</p><p className="mt-1 font-semibold text-chamDeep">{typedCampaign.deadline ? formatDate(typedCampaign.deadline) : "Không giới hạn"}</p></div>
            <div><p className="text-xs text-inkSoft">Ngày tạo</p><p className="mt-1 font-semibold text-chamDeep">{formatDate(typedCampaign.created_at)}</p></div>
            <div><p className="text-xs text-inkSoft">Công khai</p><p className="mt-1 font-semibold text-chamDeep">{formatDate(typedCampaign.published_at)}</p></div>
          </div>
          <div className="mt-6 border-t border-line pt-5"><h2 className="font-serif text-xl font-semibold text-chamDeep">Nội dung cốt lõi</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-inkMid">{typedCampaign.description || typedCampaign.summary || "Chưa có mô tả."}</p></div>
        </section>

        {contentLocked ? (
          <div className="mt-6 rounded-[10px] border border-son/30 bg-son/10 p-4 text-sm text-son">
            {typedCampaign.status === "pending_review" ? "Chiến dịch đang được Admin xét duyệt nên nội dung tạm thời bị khóa." : "Chiến dịch đã bị từ chối nên nội dung công khai không thể cập nhật."}
          </div>
        ) : (
          <div className="mt-6">
            <CampaignContentManager
              campaignId={typedCampaign.id}
              media={(mediaResult.data ?? []) as CampaignMedia[]}
              updates={(updatesResult.data ?? []) as CampaignUpdate[]}
              seo={(seoResult.data ?? null) as CampaignSeo | null}
              shareSettings={(shareResult.data ?? null) as CampaignShareSettings | null}
            />
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[12px] border border-line bg-white p-6">
            <div className="flex items-center justify-between gap-3"><h2 className="font-serif text-xl font-semibold text-chamDeep">Giao dịch ủng hộ</h2><span className="text-xs text-inkSoft">{transactions.length} gần nhất</span></div>
            {transactions.length === 0 ? <p className="mt-5 text-sm text-inkSoft">Chưa có giao dịch nào.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase text-inkSoft"><th className="px-2 py-2">Mã</th><th className="px-2 py-2 text-right">Số tiền</th><th className="px-2 py-2">Nguồn</th><th className="px-2 py-2">Trạng thái</th></tr></thead><tbody>{transactions.map((item) => { const status = transactionStatus[item.status] ?? { label: item.status, className: "bg-paperDeep text-inkMid" }; return <tr key={item.id} className="border-b border-line/70"><td className="px-2 py-3 font-mono text-xs text-chamDeep">{item.tx_ref}</td><td className="px-2 py-3 text-right font-mono font-bold text-son">{currency.format(Number(item.amount_vnd) || 0)}đ</td><td className="px-2 py-3 text-xs text-inkMid">{item.payment_provider === "wallet" ? "Ví" : "Ngân hàng"}</td><td className="px-2 py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${status.className}`}>{status.label}</span></td></tr>; })}</tbody></table></div>}
          </section>

          <section className="rounded-[12px] border border-line bg-white p-6">
            <div className="flex items-center justify-between gap-3"><h2 className="font-serif text-xl font-semibold text-chamDeep">Lịch sử trạng thái</h2><span className="text-xs text-inkSoft">{history.length} cập nhật</span></div>
            {history.length === 0 ? <p className="mt-5 text-sm text-inkSoft">Chưa có lịch sử trạng thái.</p> : <ol className="mt-5 space-y-4 border-l border-line pl-5">{history.map((event) => <li key={event.id} className="relative"><span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-sky" /><p className="font-semibold text-chamDeep">{event.from_status ? `${campaignStatus[event.from_status]?.label ?? event.from_status} → ` : "Khởi tạo → "}{campaignStatus[event.to_status]?.label ?? event.to_status}</p><p className="mt-1 text-xs text-inkSoft">{event.actor_name} ({event.actor_role ?? "system"}) · {formatDateTime(event.created_at)}</p>{event.note ? <p className="mt-1 text-sm text-son">{event.note}</p> : null}</li>)}</ol>}
          </section>
        </div>
      </section>
    </main>
  );
}
