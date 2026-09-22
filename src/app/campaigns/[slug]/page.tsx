import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CampaignDetailTabs, CampaignShare } from "@/components/campaigns/campaign-detail-tabs";
import { DonationDialog } from "@/components/campaigns/donation-dialog";
import { SiteHeader } from "@/components/site-header";
import { type CampaignMedia, type CampaignPaymentConfig, type CampaignSeo, type CampaignShareSettings, type CampaignUpdate } from "@/lib/campaigns/content";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_STATUSES = ["approved", "active", "closed"] as const;
const currency = new Intl.NumberFormat("vi-VN");
const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const statusLabels: Record<string, { label: string; className: string }> = {
  approved: { label: "Đã phê duyệt", className: "bg-luaSoft text-lua" },
  active: { label: "Đang hoạt động", className: "bg-luaSoft text-lua" },
  closed: { label: "Đã đóng", className: "bg-paperDeep text-inkMid" },
};

function formatDate(value: string | null) {
  return value ? date.format(new Date(value)) : "Chưa cập nhật";
}

function daysRemaining(value: string | null) {
  if (!value) return null;
  const difference = new Date(`${value}T23:59:59`).getTime() - Date.now();
  return Math.max(0, Math.ceil(difference / 86_400_000));
}

export default async function PublicCampaignDetailPage({ params }: { params: { slug: string } }) {
  if (!hasSupabaseEnv()) notFound();

  const supabase = createClient();
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id, organization_id, slug, title, summary, description, target_amount, campaign_type, category, province, status, deadline, published_at, created_at")
    .eq("slug", params.slug)
    .in("status", [...PUBLIC_STATUSES])
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!campaign) notFound();

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, avatar_url, license_status")
    .eq("id", campaign.organization_id)
    .maybeSingle();

  if (organizationError) throw new Error(organizationError.message);
  if (!organization || organization.license_status !== "approved") notFound();

  const [
    { data: media, error: mediaError },
    { data: updates, error: updatesError },
    { data: paymentConfig, error: paymentError },
    { data: seo, error: seoError },
    { data: shareSettings, error: shareError },
  ] = await Promise.all([
    supabase
      .from("campaign_media")
      .select("id, campaign_id, update_id, media_type, slot, provider, title, alt_text, url, public_id, thumbnail_url, sort_order, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .eq("is_public", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("campaign_updates")
      .select("id, campaign_id, update_type, title, body, location_text, event_at, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .eq("is_public", true)
      .order("event_at", { ascending: false }),
    supabase
      .from("campaign_payment_configs")
      .select("campaign_id, provider, bank_id, account_no, account_name, description_template, is_active, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("campaign_seo")
      .select("campaign_id, meta_title, meta_description, canonical_url, schema_type, schema_json, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .eq("is_public", true)
      .maybeSingle(),
    supabase
      .from("campaign_share_settings")
      .select("campaign_id, zalo_enabled, facebook_enabled, copy_enabled, share_title, share_description, share_image_url, is_public, created_at, updated_at")
      .eq("campaign_id", campaign.id)
      .eq("is_public", true)
      .maybeSingle(),
  ]);

  if (mediaError) throw new Error(mediaError.message);
  if (updatesError) throw new Error(updatesError.message);
  if (paymentError) throw new Error(paymentError.message);
  if (seoError) throw new Error(seoError.message);
  if (shareError) throw new Error(shareError.message);

  const [authResult, summaryResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("get_campaign_donation_summary", { p_campaign_id: campaign.id }),
  ]);

  if (summaryResult.error) {
    console.warn("Campaign donation summary is unavailable", {
      campaignId: campaign.id,
      code: summaryResult.error.code,
    });
  }

  const status = statusLabels[campaign.status] ?? { label: campaign.status, className: "bg-paperDeep text-inkMid" };
  const campaignType = campaign.campaign_type === "direct" ? "Trực tiếp" : "Kết nối";
  const remainingDays = daysRemaining(campaign.deadline);
  const targetAmount = Number(campaign.target_amount) || 0;
  const summaryRow = (Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data) as {
    total_amount_vnd?: number | string;
    completed_count?: number | string;
  } | null;
  const receivedAmount = Number(summaryRow?.total_amount_vnd ?? 0) || 0;
  const completedCount = Number(summaryRow?.completed_count ?? 0) || 0;
  const executionAmount = receivedAmount * 0.9;
  const operationAmount = receivedAmount * 0.1;
  const progressPercent = targetAmount > 0 ? Math.min(100, Math.round((receivedAmount / targetAmount) * 100)) : 0;
  const typedMedia = (media ?? []) as CampaignMedia[];
  const typedUpdates = (updates ?? []) as CampaignUpdate[];
  const typedPaymentConfig = (paymentConfig ?? null) as CampaignPaymentConfig | null;
  const typedSeo = (seo ?? null) as CampaignSeo | null;
  const typedShareSettings = (shareSettings ?? null) as CampaignShareSettings | null;
  const cover = typedMedia.find((item) => item.media_type === "cover") ?? null;
  const poster = typedMedia.find((item) => item.media_type === "poster") ?? null;
  const videos = typedMedia.filter((item) => item.media_type === "video");
  // A payment QR must contain a unique tx_ref. It is generated only after the
  // donor creates an intent in DonationDialog, never as a reusable static QR.
  const qrUrl = null;
  const schemaJson = typedSeo?.schema_json
    ? JSON.stringify(typedSeo.schema_json).replace(/</g, "\\u003c")
    : null;

  return (
    <main className="min-h-screen bg-paper">
      {schemaJson ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schemaJson }} /> : null}
      <SiteHeader />
      <section className="mx-auto max-w-[1160px] px-7 py-7">
        <div className="mb-4 text-xs text-inkSoft">
          <Link href="/campaigns" className="text-sky hover:underline">Chiến dịch</Link>
          <span className="px-2">›</span>
          <span>{campaign.title}</span>
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div>
            {cover ? <div className="mb-5 overflow-hidden rounded-[14px] border border-line bg-paperDeep"><img src={cover.url} alt={cover.alt_text || campaign.title} className="max-h-[420px] w-full object-cover" /></div> : null}
            <section>
              <div id="organization" className="mb-3 flex items-center gap-2.5">
                <div className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-sonSoft text-base">
                  {organization.avatar_url ? (
                    <Image src={organization.avatar_url} alt="" fill unoptimized className="object-cover" />
                  ) : "🏛️"}
                </div>
                <div>
                  <div className="text-[13px] font-bold text-chamDeep">{organization.name}</div>
                  <div className="text-[11.5px] text-lua">✓ Đã xác thực · Hồ sơ tổ chức hợp lệ</div>
                </div>
                <a href="#organization" className="ml-auto rounded-[8px] border border-lineStrong px-3 py-1.5 text-xs font-semibold text-inkMid hover:border-son hover:text-son">
                  Xem tổ chức →
                </a>
              </div>

              <h1 className="font-serif text-[30px] font-medium leading-tight text-chamDeep sm:text-[34px]">{campaign.title}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-[11px] font-bold ${status.className}`}>● {status.label}</span>
                <span className="inline-flex items-center gap-1 rounded-[4px] bg-skySoft px-2 py-1 text-[11px] font-bold text-sky">{campaignType}</span>
                {campaign.category ? <span className="inline-flex items-center gap-1 rounded-[4px] bg-paperDeep px-2 py-1 text-[11px] font-bold text-inkMid">{campaign.category}</span> : null}
                {campaign.province ? <span className="inline-flex items-center gap-1 rounded-[4px] bg-skySoft px-2 py-1 text-[11px] font-bold text-sky">📍 {campaign.province}</span> : null}
              </div>
              <p className="mt-4 text-[15px] leading-7 text-ink">{campaign.description || campaign.summary || "Chưa có mô tả chi tiết cho chiến dịch này."}</p>
            </section>

            {campaign.campaign_type === "direct" ? (
              <section className="mt-6 rounded-[10px] border border-line bg-paper p-4 sm:px-5">
                <div className="mb-2 text-[13px] font-bold text-chamDeep">Cơ chế dòng tiền (Chiến dịch Trực tiếp · Theo NĐ 93/2021)</div>
                <div className="my-2.5 flex h-2 overflow-hidden rounded-full">
                  <div className="w-[90%] bg-son" />
                  <div className="w-[10%] bg-nghe" />
                </div>
                <div className="flex justify-between gap-3 text-[11px]">
                  <span className="font-bold text-son">90% Thực thi</span>
                  <span className="font-bold text-ngheDeep">10% Vận hành</span>
                </div>
              </section>
            ) : (
              <section className="mt-6 rounded-[10px] border border-sky/25 bg-skySoft p-4 sm:px-5">
                <div className="text-[13px] font-bold text-chamDeep">Cơ chế dòng tiền (Chiến dịch Kết nối)</div>
                <p className="mt-1.5 text-sm leading-6 text-inkMid">Khoản ủng hộ được chuyển đến đối tác thụ hưởng theo thông tin đã được Admin xác nhận.</p>
              </section>
            )}

            <CashflowTree
              targetAmount={targetAmount}
              receivedAmount={receivedAmount}
              campaignType={campaign.campaign_type}
              executionAmount={executionAmount}
              operationAmount={operationAmount}
            />

            <VerificationDocuments licenseStatus={organization.license_status} />

            <CampaignDetailTabs
              title={campaign.title}
              createdAt={campaign.created_at}
              publishedAt={campaign.published_at}
              status={campaign.status}
              updates={typedUpdates}
              videos={videos}
              poster={poster}
              qrUrl={qrUrl}
            />

            <CampaignShare title={campaign.title} settings={typedShareSettings} />

            <Link href="/campaigns" className="mt-5 flex w-full items-center justify-center rounded-[8px] border border-lineStrong px-4 py-3 text-sm font-semibold text-inkMid hover:border-son hover:text-son">
              📊 Xem các chiến dịch khác →
            </Link>
          </div>

          <aside className="lg:sticky lg:top-[76px]">
            <section className="rounded-[14px] border-[1.5px] border-lineStrong bg-white p-5 shadow-card">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[21px] font-bold text-son">{currency.format(receivedAmount)}₫</span>
                <span className="text-[13px] text-inkSoft">đã tiếp nhận</span>
              </div>
              <div className="my-2 h-1.5 overflow-hidden rounded-full bg-paperDeep">
                <div className="h-full rounded-full bg-son transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="mb-4 text-xs font-bold text-son">{completedCount > 0 ? `${completedCount} lượt ủng hộ đã xác nhận · ${progressPercent}% mục tiêu` : "Chưa có giao dịch được ngân hàng xác nhận"}</div>

              <div className="mb-4 grid grid-cols-2 gap-2">
                <SidebarStat value={currency.format(targetAmount) + "₫"} label="mục tiêu" />
                <SidebarStat value={campaignType} label="loại chiến dịch" />
                <SidebarStat value={remainingDays === null ? "—" : String(remainingDays)} label="ngày còn lại" />
                <SidebarStat value={status.label} label="trạng thái" />
              </div>

              <DonationDialog
                campaignId={campaign.id}
                campaignSlug={campaign.slug}
                campaignTitle={campaign.title}
                campaignType={campaign.campaign_type}
                canDonate={campaign.status === "active" && Boolean(typedPaymentConfig?.is_active)}
                disabledReason={campaign.status === "closed" ? "Chiến dịch đã đóng" : campaign.status !== "active" ? "Chưa mở nhận ủng hộ" : "Chưa cấu hình VietQR"}
                defaultEmail={authResult.data.user?.email ?? ""}
                isAuthenticated={Boolean(authResult.data.user)}
              />
              <CampaignShare title={campaign.title} compact settings={typedShareSettings} />
              <div className="mt-3 text-[11.5px] leading-6 text-inkSoft">🔒 Mỗi lượt ủng hộ có mã giao dịch riêng. Chỉ webhook ngân hàng hợp lệ mới chuyển trạng thái từ chờ sang thành công.</div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function CashflowTree({
  targetAmount,
  receivedAmount,
  campaignType,
  executionAmount,
  operationAmount,
}: {
  targetAmount: number;
  receivedAmount: number;
  campaignType: string;
  executionAmount: number;
  operationAmount: number;
}) {
  return (
    <section className="mt-6 rounded-[14px] border border-line bg-white p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="font-serif text-xl font-medium text-chamDeep">Sơ đồ dòng tiền - Cashflow Tree</div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold text-son">{currency.format(targetAmount)}₫</div>
          <div className="text-[11px] text-inkSoft">Mục tiêu tiếp nhận</div>
        </div>
      </div>

      <TreeNode icon="💰" label="Nguồn ủng hộ vào" amount={receivedAmount} meta="Chỉ cộng các giao dịch đã được webhook ngân hàng đối soát thành công" tone="income">
        {campaignType === "direct" ? (
          <>
            <TreeNode icon="📋" label="Ví thực thi (90%)" amount={executionAmount} meta="Chỉ giải ngân theo tiến độ và chứng từ xác thực" tone="exec">
              <TreeNode icon="🎓" label="Các đợt giải ngân" meta="Chưa có dữ liệu giải ngân công khai" tone="alloc" dimmed />
            </TreeNode>
            <TreeNode icon="⚙" label="Ví vận hành (10%)" amount={operationAmount} meta="Logistics, xác thực và chi phí vận hành Quỹ" tone="ops" />
          </>
        ) : (
          <TreeNode icon="🔗" label="Đối tác thụ hưởng" amount={receivedAmount} meta="Tiền chuyển thẳng đến tài khoản đối tác và chỉ hiển thị sau khi giao dịch được xác nhận" tone="exec" />
        )}
      </TreeNode>
      <p className="mt-4 rounded-[8px] bg-paper px-3 py-2 text-xs leading-5 text-inkSoft">Dữ liệu Cashflow Tree sẽ tự động thay đổi khi hệ thống ghi nhận transaction và hồ sơ giải ngân hợp lệ.</p>
    </section>
  );
}

function TreeNode({
  icon,
  label,
  amount,
  meta,
  tone,
  dimmed = false,
  children,
}: {
  icon: string;
  label: string;
  amount?: number;
  meta: string;
  tone: "income" | "exec" | "alloc" | "ops";
  dimmed?: boolean;
  children?: ReactNode;
}) {
  const toneClass = {
    income: "border-lua bg-luaSoft",
    exec: "border-son bg-sonMid",
    alloc: "border-ngheSoft bg-ngheXsoft",
    ops: "border-sky bg-skySoft",
  }[tone];

  return (
    <div className={`mb-2 ${dimmed ? "opacity-70" : ""}`}>
      <div className="flex gap-0">
        <div className="flex w-7 shrink-0 flex-col items-center">
          <span className={`mt-4 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white ${tone === "income" ? "bg-lua shadow-[0_0_0_2px_#5D7A4B]" : tone === "exec" ? "bg-son shadow-[0_0_0_2px_#A8342B]" : tone === "alloc" ? "bg-nghe shadow-[0_0_0_2px_#E0972F]" : "bg-sky shadow-[0_0_0_2px_#3B7DD8]"}`} />
          {children ? <span className="w-0.5 flex-1 bg-line" /> : null}
        </div>
        <div className={`min-w-0 flex-1 rounded-[10px] border p-3 sm:px-4 ${toneClass}`}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="text-[13px] font-bold text-chamDeep">{icon} {label}</span>
            {amount !== undefined ? <span className="font-mono text-sm font-bold text-son">{currency.format(amount)}₫</span> : null}
          </div>
          <div className="text-xs text-inkSoft">{meta}</div>
        </div>
      </div>
      {children ? <div className="ml-7 border-l-[3px] border-line pl-4">{children}</div> : null}
    </div>
  );
}

function VerificationDocuments({ licenseStatus }: { licenseStatus: string }) {
  return (
    <section className="mt-6">
      <div className="mb-3 border-b border-line pb-2 text-sm font-bold text-chamDeep">Tài liệu xác thực</div>
      <div className="flex flex-col gap-2">
        <EvidenceRow icon="📋" title="Hồ sơ tổ chức và giấy phép hoạt động" action={licenseStatus === "approved" ? "✓ Đã xác thực" : "Đang kiểm tra"} verified={licenseStatus === "approved"} />
        <EvidenceRow icon="🏛️" title="Chiến dịch đã được Admin phê duyệt" action="✓ Đã xác thực" verified />
        <EvidenceRow icon="📄" title="Chứng từ giao dịch và giải ngân" action="Sẽ cập nhật" />
      </div>
    </section>
  );
}

function EvidenceRow({ icon, title, action, verified = false }: { icon: string; title: string; action: string; verified?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] bg-paper px-3 py-2.5 text-[13px]">
      <span className="text-base">{icon}</span>
      <div className="flex-1 font-semibold text-chamDeep">{title}</div>
      <span className={`text-xs font-semibold ${verified ? "text-lua" : "text-inkSoft"}`}>{action}</span>
    </div>
  );
}

function SidebarStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[6px] bg-paper p-2 text-center">
      <div className="font-mono text-[13px] font-bold text-chamDeep">{value}</div>
      <div className="text-[10.5px] text-inkSoft">{label}</div>
    </div>
  );
}
