"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  submitCampaignForReview,
  updateOrganizationCampaign,
  updateOrganizationProfile,
  uploadOrganizationAvatar,
  uploadOrganizationLicense,
  type OrganizationActionResult,
} from "@/app/organization/actions";
import { CreateCampaignModal } from "@/components/create-campaign-modal";
import type { ManagedCampaign, ManagedClaim, ResourceNeed, ResourceOffer } from "@/components/donate-items/donate-items-portal";
import { ResourceCampaignManager } from "@/components/organization/resource-campaign-manager";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/categories";
import { PROVINCES } from "@/lib/geo/provinces";

type Organization = {
  id: string;
  name: string;
  avatar_url: string | null;
  legal_representative_name: string;
  legal_representative_email: string | null;
  legal_representative_phone: string | null;
  license_status: string;
  license_file_path: string | null;
  license_number: string | null;
  license_note: string | null;
  verified_at: string | null;
};

type Campaign = {
  id: string;
  title: string;
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
  created_at: string;
};

type CampaignHistory = {
  id: number;
  campaign_id: string;
  from_status: string | null;
  to_status: string;
  actor_name: string;
  actor_role: string | null;
  note: string | null;
  created_at: string;
};

type Notice = { type: "success" | "error"; message: string } | null;
type BusyForm = "profile" | "avatar" | "license" | string | null;

const statusMeta: Record<string, { label: string; className: string; description: string }> = {
  pending: { label: "Chờ duyệt", className: "bg-nghe/15 text-ngheDeep", description: "Admin đang kiểm tra giấy phép hoạt động." },
  needs_revision: { label: "Cần bổ sung", className: "bg-sky/15 text-sky", description: "Hồ sơ cần được cập nhật theo ghi chú của Admin." },
  approved: { label: "Đã duyệt", className: "bg-lua/15 text-lua", description: "Tổ chức được phép tạo và gửi chiến dịch." },
  rejected: { label: "Bị từ chối", className: "bg-son/15 text-son", description: "Hãy kiểm tra lý do và nộp lại giấy phép mới." },
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

const currency = new Intl.NumberFormat("vi-VN");
const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <p className={`rounded-[8px] px-3 py-2.5 text-sm ${notice.type === "success" ? "bg-lua/10 text-lua" : "bg-son/10 text-son"}`}>{notice.message}</p>;
}

function CampaignPill({ status }: { status: string }) {
  const item = campaignStatus[status] ?? { label: status, className: "bg-inkSoft/15 text-inkSoft" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${item.className}`}>{item.label}</span>;
}

export function OrganizationDashboard({ organization, campaigns, history, page, total, totalPages, resourceCampaigns, resourceNeeds, resourceClaims, availableResourceOffers }: {
  organization: Organization;
  campaigns: Campaign[];
  history: CampaignHistory[];
  page: number;
  total: number;
  totalPages: number;
  resourceCampaigns: ManagedCampaign[];
  resourceNeeds: ResourceNeed[];
  resourceClaims: ManagedClaim[];
  availableResourceOffers: ResourceOffer[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<BusyForm>(null);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [avatarNotice, setAvatarNotice] = useState<Notice>(null);
  const [licenseNotice, setLicenseNotice] = useState<Notice>(null);
  const [campaignNotice, setCampaignNotice] = useState<Notice>(null);
  const license = statusMeta[organization.license_status] ?? statusMeta.pending;
  const canCreateCampaign = organization.license_status === "approved";

  async function runAction(key: BusyForm, action: () => Promise<OrganizationActionResult>, setNotice: (notice: Notice) => void) {
    setBusy(key);
    setNotice(null);
    try {
      const result = await action();
      setNotice({ type: result.ok ? "success" : "error", message: result.message });
      if (result.ok) router.refresh();
    } catch {
      setNotice({ type: "error", message: "Phiên đăng nhập không hợp lệ hoặc thao tác đã bị từ chối." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mx-auto max-w-[1160px] px-6 py-10">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {organization.avatar_url?.startsWith("https://res.cloudinary.com/") ? <Image src={organization.avatar_url} alt={organization.name} width={64} height={64} className="h-16 w-16 rounded-2xl border border-line object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-2xl bg-chamDeep text-2xl font-bold text-white">{organization.name.charAt(0).toUpperCase()}</div>}
          <div><p className="eyebrow">Cổng tổ chức</p><h1 className="mt-1 font-serif text-3xl font-semibold text-chamDeep">{organization.name}</h1></div>
        </div>
        <CreateCampaignModal disabled={!canCreateCampaign} disabledReason="Cần được Admin duyệt giấy phép trước khi tạo chiến dịch" />
      </div>

      <div className="mb-6 rounded-[12px] border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-xl font-semibold text-chamDeep">Trạng thái giấy phép</h2><p className="mt-1 text-sm text-inkMid">{license.description}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${license.className}`}>{license.label}</span></div>
        {organization.license_note ? <p className="mt-4 rounded-[8px] bg-nghe/10 p-3 text-sm text-ngheDeep"><strong>Ghi chú Admin:</strong> {organization.license_note}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <form action={(formData) => runAction("profile", () => updateOrganizationProfile(formData), setProfileNotice)} className="panel space-y-4">
            <div><h2 className="font-serif text-xl font-semibold text-chamDeep">Thông tin người đại diện</h2><p className="mt-1 text-sm text-inkSoft">Thông tin pháp lý được Admin dùng khi xác minh hồ sơ.</p></div>
            <NoticeBox notice={profileNotice} />
            <label className="grid gap-1 text-sm font-semibold text-chamDeep">Tên tổ chức<input name="name" defaultValue={organization.name} required minLength={2} maxLength={160} className="rounded-[8px] border border-line px-4 py-3 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold text-chamDeep">Người đại diện pháp luật<input name="representativeName" defaultValue={organization.legal_representative_name} required minLength={2} maxLength={100} className="rounded-[8px] border border-line px-4 py-3 font-normal" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-chamDeep">Email<input name="representativeEmail" type="email" defaultValue={organization.legal_representative_email ?? ""} className="rounded-[8px] border border-line px-4 py-3 font-normal" /></label>
              <label className="grid gap-1 text-sm font-semibold text-chamDeep">Số điện thoại<input name="representativePhone" defaultValue={organization.legal_representative_phone ?? ""} maxLength={20} className="rounded-[8px] border border-line px-4 py-3 font-normal" /></label>
            </div>
            <button type="submit" disabled={busy !== null} className="button-primary disabled:cursor-wait disabled:opacity-60">{busy === "profile" ? "Đang lưu…" : "Lưu thông tin"}</button>
          </form>

          <form action={(formData) => runAction("avatar", () => uploadOrganizationAvatar(formData), setAvatarNotice)} className="panel space-y-4">
            <div><h2 className="font-serif text-xl font-semibold text-chamDeep">Ảnh đại diện tổ chức</h2><p className="mt-1 text-sm text-inkSoft">JPG, PNG hoặc WebP; tối đa 5 MB. Ảnh được lưu trên Cloudinary.</p></div>
            <NoticeBox notice={avatarNotice} />
            <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full rounded-[8px] border border-line bg-white p-3 text-sm" />
            <button type="submit" disabled={busy !== null} className="rounded-[40px] border border-lineStrong px-5 py-2.5 text-sm font-bold text-chamDeep hover:border-son hover:text-son disabled:opacity-60">{busy === "avatar" ? "Đang upload…" : "Upload ảnh"}</button>
          </form>
        </div>

        <form action={(formData) => runAction("license", () => uploadOrganizationLicense(formData), setLicenseNotice)} className="panel h-fit space-y-4">
          <div><h2 className="font-serif text-xl font-semibold text-chamDeep">Giấy phép hoạt động</h2><p className="mt-1 text-sm leading-6 text-inkSoft">Upload mới sẽ chuyển hồ sơ về trạng thái chờ duyệt và thay thế tài liệu cũ.</p></div>
          <NoticeBox notice={licenseNotice} />
          {organization.license_file_path ? <a href={organization.license_file_path} target="_blank" rel="noreferrer" className="inline-flex rounded-[8px] bg-sky/10 px-3 py-2 text-sm font-bold text-sky hover:underline">Xem giấy phép hiện tại ↗</a> : <p className="rounded-[8px] bg-son/10 p-3 text-sm text-son">Chưa có giấy phép được upload.</p>}
          <label className="grid gap-1 text-sm font-semibold text-chamDeep">Số giấy phép<input name="licenseNumber" defaultValue={organization.license_number ?? ""} required maxLength={100} className="rounded-[8px] border border-line px-4 py-3 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold text-chamDeep">Tệp giấy phép<input name="license" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="block w-full rounded-[8px] border border-line bg-white p-3 font-normal" /></label>
          <p className="text-xs leading-5 text-inkSoft">Định dạng: PDF, JPG, PNG hoặc WebP; tối đa 10 MB.</p>
          <button type="submit" disabled={busy !== null} className="button-primary disabled:cursor-wait disabled:opacity-60">{busy === "license" ? "Đang upload…" : organization.license_file_path ? "Nộp lại giấy phép" : "Gửi giấy phép"}</button>
        </form>
      </div>

      <div className="mt-8 overflow-hidden rounded-[12px] border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"><div><h2 className="font-serif text-xl font-semibold text-chamDeep">Chiến dịch của tổ chức</h2><p className="mt-1 text-sm text-inkSoft">{total} chiến dịch</p></div><NoticeBox notice={campaignNotice} /></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-paper text-left text-xs uppercase tracking-wide text-inkMid"><tr><th className="px-4 py-3">Chiến dịch</th><th className="px-4 py-3">Loại</th><th className="px-4 py-3">Mục tiêu</th><th className="px-4 py-3">Thời hạn</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Thao tác</th></tr></thead><tbody>
          {campaigns.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-inkSoft">Chưa có chiến dịch nào.</td></tr> : campaigns.map((campaign) => {
            const events = history.filter((item) => item.campaign_id === campaign.id);
            const editable = ["draft", "needs_revision"].includes(campaign.status);
            return <tr key={campaign.id} className="border-t border-line align-top">
              <td className="px-4 py-3">
                <Link href={`/organization/campaigns/${campaign.id}`} className="font-bold text-chamDeep hover:text-son hover:underline">{campaign.title}</Link>
                <div className="mt-1 text-xs text-inkSoft">{campaign.category ?? "Chưa phân loại"} · tạo {date.format(new Date(campaign.created_at))}</div>
                {campaign.review_note ? <p className="mt-2 text-xs text-son">Admin: {campaign.review_note}</p> : null}
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-bold text-sky">Lịch sử trạng thái ({events.length})</summary>
                  <ol className="mt-2 space-y-2 border-l border-line pl-3">
                    {events.map((event) => <li key={event.id}><div className="font-semibold text-chamDeep">{event.from_status ? `${campaignStatus[event.from_status]?.label ?? event.from_status} → ` : "Khởi tạo → "}{campaignStatus[event.to_status]?.label ?? event.to_status}</div><div className="text-inkSoft">{event.actor_name} ({event.actor_role ?? "system"}) · {dateTime.format(new Date(event.created_at))}</div>{event.note ? <div className="mt-0.5 text-son">{event.note}</div> : null}</li>)}
                  </ol>
                </details>
              </td>
              <td className="px-4 py-3 text-inkMid">{campaign.campaign_type === "direct" ? "Trực tiếp" : "Kết nối"}</td>
              <td className="px-4 py-3 font-mono font-bold text-son">{currency.format(Number(campaign.target_amount) || 0)}đ</td>
              <td className="px-4 py-3 text-inkMid">{campaign.deadline ? date.format(new Date(campaign.deadline)) : "Không giới hạn"}</td>
              <td className="px-4 py-3"><CampaignPill status={campaign.status} /></td>
              <td className="w-72 px-4 py-3">
                {editable ? <div className="space-y-2">
                  <button type="button" disabled={busy !== null || !canCreateCampaign} onClick={() => runAction(`campaign-${campaign.id}`, () => submitCampaignForReview(campaign.id), setCampaignNotice)} className="rounded-[6px] bg-chamDeep px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{busy === `campaign-${campaign.id}` ? "Đang gửi…" : "Gửi duyệt"}</button>
                  <details>
                    <summary className="cursor-pointer text-xs font-bold text-sky">Chỉnh sửa nội dung</summary>
                    <form action={(formData) => runAction(`edit-${campaign.id}`, () => updateOrganizationCampaign(campaign.id, formData), setCampaignNotice)} className="mt-2 grid gap-2 rounded-[8px] bg-paper p-3">
                      <input name="title" defaultValue={campaign.title} required minLength={5} maxLength={180} className="rounded-[6px] border border-line px-2 py-1.5 text-xs" placeholder="Tên chiến dịch" />
                      <div className="grid grid-cols-2 gap-2"><input name="targetAmount" type="number" min={1} defaultValue={campaign.target_amount} required className="rounded-[6px] border border-line px-2 py-1.5 text-xs" /><input name="deadline" type="date" defaultValue={campaign.deadline ?? ""} className="rounded-[6px] border border-line px-2 py-1.5 text-xs" /></div>
                      <div className="grid grid-cols-2 gap-2"><select name="campaignType" defaultValue={campaign.campaign_type} className="rounded-[6px] border border-line bg-white px-2 py-1.5 text-xs"><option value="direct">Trực tiếp</option><option value="partner">Kết nối</option></select><select name="category" defaultValue={campaign.category ?? CAMPAIGN_CATEGORIES[0]} className="rounded-[6px] border border-line bg-white px-2 py-1.5 text-xs">{CAMPAIGN_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></div>
                      <select name="province" defaultValue={campaign.province ?? PROVINCES[0]} className="rounded-[6px] border border-line bg-white px-2 py-1.5 text-xs">{PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}</select>
                      <textarea name="description" defaultValue={campaign.description} maxLength={5000} rows={3} className="rounded-[6px] border border-line px-2 py-1.5 text-xs" placeholder="Mô tả chiến dịch" />
                      <button type="submit" disabled={busy !== null} className="rounded-[6px] bg-sky px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy === `edit-${campaign.id}` ? "Đang lưu…" : "Lưu chỉnh sửa"}</button>
                    </form>
                  </details>
                </div> : <span className="text-xs text-inkSoft">Nội dung đã khóa</span>}
              </td>
            </tr>;
          })}</tbody></table></div>
        {totalPages > 1 ? <div className="flex items-center justify-between border-t border-line px-5 py-4 text-sm"><span className="text-inkSoft">Trang {page}/{totalPages}</span><div className="flex gap-2"><Link aria-disabled={page <= 1} href={`/organization?page=${Math.max(1, page - 1)}`} className={`rounded-[6px] border border-lineStrong px-3 py-2 font-bold ${page <= 1 ? "pointer-events-none opacity-40" : "hover:border-son hover:text-son"}`}>← Trước</Link><Link aria-disabled={page >= totalPages} href={`/organization?page=${Math.min(totalPages, page + 1)}`} className={`rounded-[6px] border border-lineStrong px-3 py-2 font-bold ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:border-son hover:text-son"}`}>Sau →</Link></div></div> : null}
      </div>

      <ResourceCampaignManager
        campaigns={resourceCampaigns}
        needs={resourceNeeds}
        claims={resourceClaims}
        availableOffers={availableResourceOffers}
      />
    </section>
  );
}
