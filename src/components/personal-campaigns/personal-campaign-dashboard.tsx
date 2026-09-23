"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createPersonalCampaign,
  submitPersonalCampaignForReview,
  submitPersonalVerification,
  updatePersonalCampaign,
  type PersonalCampaignActionResult,
} from "@/app/personal-campaigns/actions";
import { CreateCampaignModal } from "@/components/create-campaign-modal";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/categories";
import { PROVINCES } from "@/lib/geo/provinces";

type PersonalProfile = {
  user_id: string;
  legal_name: string;
  phone: string | null;
  verification_status: string;
  verification_document_path: string | null;
  verification_note: string | null;
  verified_at: string | null;
};

type Campaign = {
  id: string;
  slug: string;
  title: string;
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
type BusyKey = "verification" | string | null;

const verificationStatus: Record<string, { label: string; className: string; description: string }> = {
  pending: { label: "Chờ xác minh", className: "bg-nghe/15 text-ngheDeep", description: "Hồ sơ đang chờ Admin kiểm tra." },
  needs_revision: { label: "Cần bổ sung", className: "bg-sky/15 text-sky", description: "Hãy đọc ghi chú của Admin, cập nhật giấy tờ và gửi lại." },
  approved: { label: "Đã xác minh", className: "bg-lua/15 text-lua", description: "Bạn được phép tạo và gửi chiến dịch cá nhân." },
  rejected: { label: "Bị từ chối", className: "bg-son/15 text-son", description: "Hồ sơ chưa đủ điều kiện. Bạn có thể nộp lại giấy tờ mới." },
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

function StatusPill({ status }: { status: string }) {
  const item = campaignStatus[status] ?? { label: status, className: "bg-inkSoft/15 text-inkSoft" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${item.className}`}>{item.label}</span>;
}

export function PersonalCampaignDashboard({
  profile,
  campaigns,
  history,
  page,
  total,
  totalPages,
}: {
  profile: PersonalProfile | null;
  campaigns: Campaign[];
  history: CampaignHistory[];
  page: number;
  total: number;
  totalPages: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<BusyKey>(null);
  const [verificationNotice, setVerificationNotice] = useState<Notice>(null);
  const [campaignNotice, setCampaignNotice] = useState<Notice>(null);
  const verification = verificationStatus[profile?.verification_status ?? "pending"] ?? verificationStatus.pending;
  const canCreateCampaign = profile?.verification_status === "approved";

  async function runAction(key: BusyKey, action: () => Promise<PersonalCampaignActionResult>, setNotice: (notice: Notice) => void) {
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
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-son text-2xl font-bold text-white">👤</div>
          <div><p className="eyebrow">Cổng chiến dịch cá nhân</p><h1 className="mt-1 font-serif text-3xl font-semibold text-chamDeep">Chủ sở hữu cá nhân</h1></div>
        </div>
        <CreateCampaignModal
          disabled={!canCreateCampaign}
          disabledReason="Cần được Admin xác minh hồ sơ cá nhân trước khi tạo chiến dịch"
          createAction={createPersonalCampaign}
          successMessage="Đã tạo bản nháp chiến dịch cá nhân. Bạn có thể gửi hồ sơ cho Admin xét duyệt."
          reviewNote="Chiến dịch cá nhân vẫn phải qua Admin duyệt trước khi công khai. Thông tin nhận tiền sẽ do Admin kiểm tra và cấu hình riêng."
        />
      </div>

      <div className="mb-6 rounded-[12px] border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-xl font-semibold text-chamDeep">Xác minh hồ sơ cá nhân</h2><p className="mt-1 text-sm text-inkMid">Đây là quy trình riêng cho người dùng cá nhân, không dùng giấy phép tổ chức.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${verification.className}`}>{verification.label}</span></div>
        <p className="mt-3 text-sm text-inkMid">{verification.description}</p>
        {profile?.verification_note ? <p className="mt-4 rounded-[8px] bg-nghe/10 p-3 text-sm text-ngheDeep"><strong>Ghi chú Admin:</strong> {profile.verification_note}</p> : null}
        {profile?.verified_at ? <p className="mt-3 text-xs text-inkSoft">Xác minh lần gần nhất: {dateTime.format(new Date(profile.verified_at))}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form action={(formData) => runAction("verification", () => submitPersonalVerification(formData), setVerificationNotice)} className="panel h-fit space-y-4">
          <div><h2 className="font-serif text-xl font-semibold text-chamDeep">Hồ sơ người sở hữu</h2><p className="mt-1 text-sm leading-6 text-inkSoft">Upload giấy tờ xác minh danh tính để Admin đối chiếu. File được lưu trong vùng riêng tư, không công khai trên trang chiến dịch.</p></div>
          <NoticeBox notice={verificationNotice} />
          <label className="grid gap-1 text-sm font-semibold text-chamDeep">Họ tên người sở hữu<input name="legalName" defaultValue={profile?.legal_name ?? ""} required minLength={2} maxLength={160} className="rounded-[8px] border border-line px-4 py-3 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold text-chamDeep">Số điện thoại<input name="phone" defaultValue={profile?.phone ?? ""} maxLength={30} className="rounded-[8px] border border-line px-4 py-3 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold text-chamDeep">Giấy tờ xác minh mới<input name="verificationDocument" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="block w-full rounded-[8px] border border-line bg-white p-3 font-normal" /></label>
          <p className="text-xs leading-5 text-inkSoft">Định dạng: PDF, JPG, PNG hoặc WebP; tối đa 10 MB. Nộp file mới sẽ tạo một phiên xác minh mới.</p>
          <button type="submit" disabled={busy !== null} className="button-primary disabled:cursor-wait disabled:opacity-60">{busy === "verification" ? "Đang gửi…" : profile ? "Nộp lại hồ sơ" : "Gửi hồ sơ xác minh"}</button>
        </form>

        <div className="panel h-fit">
          <div className="mb-4"><h2 className="font-serif text-xl font-semibold text-chamDeep">Điều kiện tạo chiến dịch</h2><p className="mt-1 text-sm leading-6 text-inkSoft">Hệ thống kiểm tra ở cả giao diện, Server Action và RLS nên không thể bỏ qua bước xác minh bằng cách gọi API trực tiếp.</p></div>
          <div className="space-y-3 text-sm">
            <div className={`rounded-[8px] border p-3 ${profile ? "border-lua/40 bg-lua/5" : "border-line bg-paper"}`}><strong className="text-chamDeep">01 · Có hồ sơ cá nhân</strong><p className="mt-1 text-inkMid">Khai báo họ tên, số điện thoại và giấy tờ xác minh.</p></div>
            <div className={`rounded-[8px] border p-3 ${canCreateCampaign ? "border-lua/40 bg-lua/5" : "border-line bg-paper"}`}><strong className="text-chamDeep">02 · Admin phê duyệt hồ sơ</strong><p className="mt-1 text-inkMid">Chỉ trạng thái <code>approved</code> mới mở quyền tạo campaign.</p></div>
            <div className="rounded-[8px] border border-line bg-paper p-3"><strong className="text-chamDeep">03 · Admin duyệt campaign</strong><p className="mt-1 text-inkMid">Campaign sau khi tạo vẫn bắt buộc đi qua vòng <code>pending_review</code>.</p></div>
          </div>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-[12px] border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"><div><h2 className="font-serif text-xl font-semibold text-chamDeep">Chiến dịch cá nhân của tôi</h2><p className="mt-1 text-sm text-inkSoft">{total} chiến dịch</p></div><NoticeBox notice={campaignNotice} /></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-paper text-left text-xs uppercase tracking-wide text-inkMid"><tr><th className="px-4 py-3">Chiến dịch</th><th className="px-4 py-3">Loại</th><th className="px-4 py-3">Mục tiêu</th><th className="px-4 py-3">Thời hạn</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Thao tác</th></tr></thead><tbody>
          {campaigns.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-inkSoft">Chưa có chiến dịch cá nhân nào.</td></tr> : campaigns.map((campaign) => {
            const events = history.filter((item) => item.campaign_id === campaign.id);
            const editable = ["draft", "needs_revision"].includes(campaign.status);
            const campaignHref = ["approved", "active", "closed"].includes(campaign.status)
              ? `/campaigns/${encodeURIComponent(campaign.slug)}`
              : "/personal-campaigns";
            return <tr key={campaign.id} className="border-t border-line align-top">
              <td className="px-4 py-3"><Link href={campaignHref} className="font-bold text-chamDeep hover:text-son hover:underline">{campaign.title}</Link><div className="mt-1 text-xs text-inkSoft">{campaign.category ?? "Chưa phân loại"} · tạo {date.format(new Date(campaign.created_at))}</div>{campaign.review_note ? <p className="mt-2 text-xs text-son">Admin: {campaign.review_note}</p> : null}<details className="mt-2 text-xs"><summary className="cursor-pointer font-bold text-sky">Lịch sử trạng thái ({events.length})</summary><ol className="mt-2 space-y-2 border-l border-line pl-3">{events.map((event) => <li key={event.id}><div className="font-semibold text-chamDeep">{event.from_status ? `${campaignStatus[event.from_status]?.label ?? event.from_status} → ` : "Khởi tạo → "}{campaignStatus[event.to_status]?.label ?? event.to_status}</div><div className="text-inkSoft">{event.actor_name} ({event.actor_role ?? "system"}) · {dateTime.format(new Date(event.created_at))}</div>{event.note ? <div className="mt-0.5 text-son">{event.note}</div> : null}</li>)}</ol></details></td>
              <td className="px-4 py-3 text-inkMid">{campaign.campaign_type === "direct" ? "Trực tiếp" : "Kết nối"}</td>
              <td className="px-4 py-3 font-mono font-bold text-son">{currency.format(Number(campaign.target_amount) || 0)}đ</td>
              <td className="px-4 py-3 text-inkMid">{campaign.deadline ? date.format(new Date(campaign.deadline)) : "Không giới hạn"}</td>
              <td className="px-4 py-3"><StatusPill status={campaign.status} /></td>
              <td className="w-72 px-4 py-3"><div className="space-y-2">{campaign.status !== "rejected" ? <Link href={`/campaign-management/${campaign.id}`} className="inline-flex rounded-[6px] border border-son px-3 py-2 text-xs font-bold text-son hover:bg-son hover:text-white">Quản lý nội dung & Viral Kit</Link> : null}{editable ? <div className="space-y-2"><button type="button" disabled={busy !== null || !canCreateCampaign} onClick={() => runAction(`campaign-${campaign.id}`, () => submitPersonalCampaignForReview(campaign.id), setCampaignNotice)} className="rounded-[6px] bg-chamDeep px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{busy === `campaign-${campaign.id}` ? "Đang gửi…" : "Gửi duyệt"}</button><details><summary className="cursor-pointer text-xs font-bold text-sky">Chỉnh sửa thông tin lõi</summary><form action={(formData) => runAction(`edit-${campaign.id}`, () => updatePersonalCampaign(campaign.id, formData), setCampaignNotice)} className="mt-2 grid gap-2 rounded-[8px] bg-paper p-3"><input name="title" defaultValue={campaign.title} required minLength={5} maxLength={180} className="rounded-[6px] border border-line px-2 py-1.5 text-xs" placeholder="Tên chiến dịch" /><div className="grid grid-cols-2 gap-2"><input name="targetAmount" type="number" min={1} defaultValue={campaign.target_amount} required className="rounded-[6px] border border-line px-2 py-1.5 text-xs" /><input name="deadline" type="date" defaultValue={campaign.deadline ?? ""} className="rounded-[6px] border border-line px-2 py-1.5 text-xs" /></div><div className="grid grid-cols-2 gap-2"><select name="campaignType" defaultValue={campaign.campaign_type} className="rounded-[6px] border border-line bg-white px-2 py-1.5 text-xs"><option value="direct">Trực tiếp</option><option value="partner">Kết nối</option></select><select name="category" defaultValue={campaign.category ?? CAMPAIGN_CATEGORIES[0]} className="rounded-[6px] border border-line bg-white px-2 py-1.5 text-xs">{CAMPAIGN_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></div><select name="province" defaultValue={campaign.province ?? PROVINCES[0]} className="rounded-[6px] border border-line bg-white px-2 py-1.5 text-xs">{PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}</select><textarea name="description" defaultValue={campaign.description} maxLength={5000} rows={3} className="rounded-[6px] border border-line px-2 py-1.5 text-xs" placeholder="Mô tả chiến dịch" /><button type="submit" disabled={busy !== null} className="rounded-[6px] bg-sky px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy === `edit-${campaign.id}` ? "Đang lưu…" : "Lưu chỉnh sửa"}</button></form></details></div> : <span className="block text-xs text-inkSoft">Thông tin lõi đã khóa; nội dung truyền thông vẫn có thể cập nhật.</span>}</div></td>
            </tr>;
          })}</tbody></table></div>
        {totalPages > 1 ? <div className="flex items-center justify-between border-t border-line px-5 py-4 text-sm"><span className="text-inkSoft">Trang {page}/{totalPages}</span><div className="flex gap-2"><Link aria-disabled={page <= 1} href={`/personal-campaigns?page=${Math.max(1, page - 1)}`} className={`rounded-[6px] border border-lineStrong px-3 py-2 font-bold ${page <= 1 ? "pointer-events-none opacity-40" : "hover:border-son hover:text-son"}`}>← Trước</Link><Link aria-disabled={page >= totalPages} href={`/personal-campaigns?page=${Math.min(totalPages, page + 1)}`} className={`rounded-[6px] border border-lineStrong px-3 py-2 font-bold ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:border-son hover:text-son"}`}>Sau →</Link></div></div> : null}
      </div>
    </section>
  );
}
