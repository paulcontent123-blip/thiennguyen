"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  deleteCampaignMedia,
  deleteCampaignPaymentConfig,
  deleteCampaignSeo,
  deleteCampaignShareSettings,
  deleteCampaignUpdate,
  generateCampaignPoster,
  upsertCampaignMedia,
  upsertCampaignPaymentConfig,
  upsertCampaignSeo,
  upsertCampaignShareSettings,
  upsertCampaignUpdate,
  type CampaignContentActionResult,
} from "@/app/organization/campaign-content-actions";
import type {
  CampaignMedia,
  CampaignPaymentConfig,
  CampaignSeo,
  CampaignShareSettings,
  CampaignUpdate,
} from "@/lib/campaigns/content";

type Notice = { type: "success" | "error"; message: string } | null;

function dateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <p className={`rounded-[8px] px-3 py-2.5 text-sm ${notice.type === "success" ? "bg-lua/10 text-lua" : "bg-son/10 text-son"}`}>{notice.message}</p>;
}

function PublicCheckbox({ name, label, checked = false }: { name: string; label: string; checked?: boolean }) {
  return <label className="flex items-center gap-2 text-xs text-inkMid"><input name={name} type="checkbox" defaultChecked={checked} />{label}</label>;
}

export function CampaignContentManager({
  campaignId,
  media,
  updates,
  paymentConfig,
  seo,
  shareSettings,
}: {
  campaignId: string;
  media: CampaignMedia[];
  updates: CampaignUpdate[];
  paymentConfig: CampaignPaymentConfig | null;
  seo: CampaignSeo | null;
  shareSettings: CampaignShareSettings | null;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<CampaignContentActionResult>) {
    setBusy(key);
    setNotice(null);
    try {
      const result = await action();
      setNotice({ type: result.ok ? "success" : "error", message: result.message });
      if (result.ok) router.refresh();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Không thể thực hiện thao tác." });
    } finally {
      setBusy(null);
    }
  }

  const cover = media.find((item) => item.media_type === "cover") ?? null;
  const poster = media.find((item) => item.media_type === "poster") ?? null;
  const videos = media.filter((item) => item.media_type === "video");

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-[12px] border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-semibold text-chamDeep">Quản lý nội dung công khai</h2>
            <p className="mt-1 text-sm leading-6 text-inkSoft">Lưu media, VietQR, Schema.org và cấu hình chia sẻ cho trang chiến dịch.</p>
          </div>
          <span className="rounded-full bg-sky/10 px-3 py-1 text-xs font-bold text-sky">CRUD theo chiến dịch</span>
        </div>
        <div className="mt-4"><NoticeBox notice={notice} /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MediaForm
          title="Ảnh cover chiến dịch"
          description="JPG, PNG hoặc WebP, tối đa 10 MB. File được lưu vào Cloudinary; URL và public ID lưu trong Database."
          campaignId={campaignId}
          media={cover}
          mediaType="cover"
          busy={busy === "cover"}
          onSubmit={(formData) => run("cover", () => upsertCampaignMedia(formData))}
          onDelete={cover ? () => run("delete-cover", () => deleteCampaignMedia(cover.id)) : undefined}
        />
        <MediaForm
          title="Poster Viral Kit"
          description="Poster 9:16 có thể upload thủ công trước khi tích hợp cơ chế sinh tự động."
          campaignId={campaignId}
          media={poster}
          mediaType="poster"
          busy={busy === "poster" || busy === "generate-poster"}
          onSubmit={(formData) => run("poster", () => upsertCampaignMedia(formData))}
          onDelete={poster ? () => run("delete-poster", () => deleteCampaignMedia(poster.id)) : undefined}
          onGenerate={() => run("generate-poster", () => generateCampaignPoster(campaignId))}
        />
      </div>

      <section className="rounded-[12px] border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-serif text-xl font-semibold text-chamDeep">Video 9:16</h2><p className="mt-1 text-sm text-inkSoft">Lưu URL YouTube, Facebook Reels, TikTok hoặc URL HTTPS khác.</p></div>
          <span className="text-xs text-inkSoft">{videos.length} video</span>
        </div>
        <form action={(formData) => run("video-new", () => upsertCampaignMedia(formData))} className="mt-5 grid gap-3 rounded-[8px] bg-paper p-4 md:grid-cols-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="mediaType" value="video" />
          <input name="title" required maxLength={180} placeholder="Tiêu đề video" className="rounded-[8px] border border-line bg-white px-3 py-2 text-sm" />
          <select name="slot" defaultValue="start" className="rounded-[8px] border border-line bg-white px-3 py-2 text-sm"><option value="start">Ngày bắt đầu triển khai</option><option value="mid">Cập nhật giữa kỳ</option><option value="handover">Kết quả bàn giao</option></select>
          <input name="url" type="url" required placeholder="https://..." className="rounded-[8px] border border-line bg-white px-3 py-2 text-sm md:col-span-2" />
          <input name="thumbnailUrl" type="url" placeholder="Thumbnail URL (không bắt buộc)" className="rounded-[8px] border border-line bg-white px-3 py-2 text-sm" />
          <input name="sortOrder" type="number" min={0} defaultValue={0} placeholder="Thứ tự" className="rounded-[8px] border border-line bg-white px-3 py-2 text-sm" />
          <div className="flex items-center justify-between gap-3 md:col-span-2"><PublicCheckbox name="isPublic" label="Hiển thị công khai" checked /><button type="submit" disabled={busy !== null} className="button-primary disabled:opacity-50">{busy === "video-new" ? "Đang lưu…" : "Thêm video"}</button></div>
        </form>
        <div className="mt-4 space-y-3">
          {videos.map((item) => <MediaEditRow key={item.id} item={item} busy={busy} onSubmit={(formData) => run(`video-${item.id}`, () => upsertCampaignMedia(formData))} onDelete={() => run(`delete-${item.id}`, () => deleteCampaignMedia(item.id))} />)}
          {videos.length === 0 ? <p className="text-sm text-inkSoft">Chưa có video nào.</p> : null}
        </div>
      </section>

      <section className="rounded-[12px] border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-xl font-semibold text-chamDeep">Nhật ký thực địa</h2><p className="mt-1 text-sm text-inkSoft">Các bản cập nhật này sẽ xuất hiện trong tab Nhật ký thực địa nếu được công khai.</p></div><span className="text-xs text-inkSoft">{updates.length} bản cập nhật</span></div>
        <form action={(formData) => run("update-new", () => upsertCampaignUpdate(formData))} className="mt-5 grid gap-3 rounded-[8px] bg-paper p-4 md:grid-cols-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <input name="title" required maxLength={180} placeholder="Tiêu đề cập nhật" className="rounded-[8px] border border-line bg-white px-3 py-2 text-sm" />
          <select name="updateType" defaultValue="general" className="rounded-[8px] border border-line bg-white px-3 py-2 text-sm"><option value="general">Cập nhật chung</option><option value="start">Bắt đầu triển khai</option><option value="mid">Cập nhật giữa kỳ</option><option value="handover">Kết quả bàn giao</option></select>
          <textarea name="body" required maxLength={10000} rows={3} placeholder="Nội dung cập nhật" className="rounded-[8px] border border-line bg-white px-3 py-2 text-sm md:col-span-2" />
          <input name="locationText" maxLength={180} placeholder="Địa điểm (không bắt buộc)" className="rounded-[8px] border border-line bg-white px-3 py-2 text-sm" />
          <input name="eventAt" type="datetime-local" className="rounded-[8px] border border-line bg-white px-3 py-2 text-sm" />
          <div className="flex items-center justify-between gap-3 md:col-span-2"><PublicCheckbox name="isPublic" label="Hiển thị công khai" checked /><button type="submit" disabled={busy !== null} className="button-primary disabled:opacity-50">{busy === "update-new" ? "Đang lưu…" : "Thêm cập nhật"}</button></div>
        </form>
        <div className="mt-4 space-y-3">
          {updates.map((item) => <UpdateEditRow key={item.id} item={item} busy={busy} onSubmit={(formData) => run(`update-${item.id}`, () => upsertCampaignUpdate(formData))} onDelete={() => run(`delete-update-${item.id}`, () => deleteCampaignUpdate(item.id))} />)}
          {updates.length === 0 ? <p className="text-sm text-inkSoft">Chưa có nhật ký thực địa.</p> : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[12px] border border-line bg-white p-6">
          <h2 className="font-serif text-xl font-semibold text-chamDeep">VietQR động</h2>
          <p className="mt-1 text-sm leading-6 text-inkSoft">Chỉ lưu thông tin tài khoản nhận tiền. QR sẽ được sinh theo số tiền và mã giao dịch khi mở luồng quyên góp.</p>
          <form action={(formData) => run("payment", () => upsertCampaignPaymentConfig(formData))} className="mt-5 space-y-3">
            <input type="hidden" name="campaignId" value={campaignId} />
            <input name="bankId" required defaultValue={paymentConfig?.bank_id ?? ""} placeholder="Mã ngân hàng, ví dụ MBBank" className="w-full rounded-[8px] border border-line px-3 py-2 text-sm" />
            <input name="accountNo" required defaultValue={paymentConfig?.account_no ?? ""} placeholder="Số tài khoản" className="w-full rounded-[8px] border border-line px-3 py-2 text-sm" />
            <input name="accountName" required defaultValue={paymentConfig?.account_name ?? ""} placeholder="Tên tài khoản" className="w-full rounded-[8px] border border-line px-3 py-2 text-sm" />
            <input name="descriptionTemplate" defaultValue={paymentConfig?.description_template ?? "TN-{campaign_slug}"} placeholder="TN-{campaign_slug} hoặc TN-{tx_ref}" className="w-full rounded-[8px] border border-line px-3 py-2 text-sm" />
            <div className="flex items-center justify-between gap-3"><PublicCheckbox name="isActive" label="Cho phép hiển thị QR công khai" checked={paymentConfig?.is_active ?? false} /><button type="submit" disabled={busy !== null} className="button-primary disabled:opacity-50">{busy === "payment" ? "Đang lưu…" : "Lưu VietQR"}</button></div>
          </form>
          {paymentConfig ? <button type="button" onClick={() => run("delete-payment", () => deleteCampaignPaymentConfig(campaignId))} disabled={busy !== null} className="mt-3 text-xs font-bold text-son hover:underline">Xóa cấu hình VietQR</button> : null}
        </section>

        <section className="rounded-[12px] border border-line bg-white p-6">
          <h2 className="font-serif text-xl font-semibold text-chamDeep">Schema.org và SEO</h2>
          <p className="mt-1 text-sm leading-6 text-inkSoft">Lưu JSON-LD để trang công khai có thể render dữ liệu có cấu trúc.</p>
          <form action={(formData) => run("seo", () => upsertCampaignSeo(formData))} className="mt-5 space-y-3">
            <input type="hidden" name="campaignId" value={campaignId} />
            <input name="metaTitle" defaultValue={seo?.meta_title ?? ""} maxLength={180} placeholder="Meta title" className="w-full rounded-[8px] border border-line px-3 py-2 text-sm" />
            <textarea name="metaDescription" defaultValue={seo?.meta_description ?? ""} maxLength={320} rows={2} placeholder="Meta description" className="w-full rounded-[8px] border border-line px-3 py-2 text-sm" />
            <input name="canonicalUrl" type="url" defaultValue={seo?.canonical_url ?? ""} placeholder="Canonical URL HTTPS" className="w-full rounded-[8px] border border-line px-3 py-2 text-sm" />
            <input name="schemaType" defaultValue={seo?.schema_type ?? "LiveBlogPosting"} maxLength={80} placeholder="LiveBlogPosting" className="w-full rounded-[8px] border border-line px-3 py-2 text-sm" />
            <textarea name="schemaJson" defaultValue={seo ? JSON.stringify(seo.schema_json, null, 2) : ""} rows={7} placeholder="Để trống để hệ thống tạo JSON-LD mặc định" className="w-full rounded-[8px] border border-line px-3 py-2 font-mono text-xs" />
            <div className="flex items-center justify-between gap-3"><PublicCheckbox name="isPublic" label="Render Schema.org công khai" checked={seo?.is_public ?? true} /><button type="submit" disabled={busy !== null} className="button-primary disabled:opacity-50">{busy === "seo" ? "Đang lưu…" : "Lưu Schema.org"}</button></div>
          </form>
          {seo ? <button type="button" onClick={() => run("delete-seo", () => deleteCampaignSeo(campaignId))} disabled={busy !== null} className="mt-3 text-xs font-bold text-son hover:underline">Xóa cấu hình SEO</button> : null}
        </section>
      </div>

      <section className="rounded-[12px] border border-line bg-white p-6">
        <h2 className="font-serif text-xl font-semibold text-chamDeep">Cấu hình chia sẻ</h2>
        <p className="mt-1 text-sm leading-6 text-inkSoft">URL Zalo/Facebook và URL sao chép được tạo từ slug hiện tại; Database chỉ lưu bật/tắt kênh và metadata chia sẻ.</p>
        <form action={(formData) => run("share", () => upsertCampaignShareSettings(formData))} className="mt-5 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <input name="shareTitle" defaultValue={shareSettings?.share_title ?? ""} maxLength={180} placeholder="Tiêu đề khi chia sẻ" className="rounded-[8px] border border-line px-3 py-2 text-sm" />
          <input name="shareImageUrl" type="url" defaultValue={shareSettings?.share_image_url ?? ""} placeholder="Ảnh Open Graph HTTPS" className="rounded-[8px] border border-line px-3 py-2 text-sm" />
          <textarea name="shareDescription" defaultValue={shareSettings?.share_description ?? ""} maxLength={320} rows={2} placeholder="Mô tả khi chia sẻ" className="rounded-[8px] border border-line px-3 py-2 text-sm md:col-span-2" />
          <div className="flex flex-wrap items-center gap-4 md:col-span-2"><PublicCheckbox name="zaloEnabled" label="Zalo" checked={shareSettings?.zalo_enabled ?? true} /><PublicCheckbox name="facebookEnabled" label="Facebook" checked={shareSettings?.facebook_enabled ?? true} /><PublicCheckbox name="copyEnabled" label="Sao chép link" checked={shareSettings?.copy_enabled ?? true} /><PublicCheckbox name="isPublic" label="Hiển thị công khai" checked={shareSettings?.is_public ?? true} /></div>
          <div className="flex items-center justify-between md:col-span-2"><span className="text-xs text-inkSoft">Không lưu dữ liệu cá nhân người bấm chia sẻ.</span><button type="submit" disabled={busy !== null} className="button-primary disabled:opacity-50">{busy === "share" ? "Đang lưu…" : "Lưu cấu hình chia sẻ"}</button></div>
        </form>
        {shareSettings ? <button type="button" onClick={() => run("delete-share", () => deleteCampaignShareSettings(campaignId))} disabled={busy !== null} className="mt-3 text-xs font-bold text-son hover:underline">Xóa cấu hình chia sẻ</button> : null}
      </section>
    </section>
  );
}

function MediaForm({ title, description, campaignId, media, mediaType, busy, onSubmit, onDelete, onGenerate }: { title: string; description: string; campaignId: string; media: CampaignMedia | null; mediaType: "cover" | "poster"; busy: boolean; onSubmit: (formData: FormData) => void; onDelete?: () => void; onGenerate?: () => void }) {
  return <section className="rounded-[12px] border border-line bg-white p-6">
    <h2 className="font-serif text-xl font-semibold text-chamDeep">{title}</h2>
    <p className="mt-1 text-sm leading-6 text-inkSoft">{description}</p>
    {media ? <a href={media.url} target="_blank" rel="noreferrer" className="mt-4 block truncate text-xs font-bold text-sky hover:underline">Media hiện tại: {media.url}</a> : null}
    <form action={onSubmit} className="mt-4 space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="mediaId" value={media?.id ?? ""} />
      <input type="hidden" name="mediaType" value={mediaType} />
      <input name="title" defaultValue={media?.title ?? ""} maxLength={180} placeholder="Tên media" className="w-full rounded-[8px] border border-line px-3 py-2 text-sm" />
      <input name="altText" defaultValue={media?.alt_text ?? ""} maxLength={300} placeholder="Alt text" className="w-full rounded-[8px] border border-line px-3 py-2 text-sm" />
      <input name="url" type="url" defaultValue={media?.url ?? ""} placeholder="Hoặc nhập URL HTTPS" className="w-full rounded-[8px] border border-line px-3 py-2 text-sm" />
      <input name="file" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full rounded-[8px] border border-line bg-white p-2 text-sm" />
      <div className="flex flex-wrap items-center justify-between gap-3"><PublicCheckbox name="isPublic" label="Hiển thị công khai" checked={media?.is_public ?? true} /><div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className="button-primary disabled:opacity-50">{busy ? "Đang lưu…" : media ? "Cập nhật" : "Lưu media"}</button>{onGenerate ? <button type="button" onClick={onGenerate} disabled={busy} className="rounded-[40px] border border-sky px-4 py-2 text-xs font-bold text-sky disabled:opacity-50">{busy ? "Đang sinh…" : "Sinh từ cover"}</button> : null}{onDelete ? <button type="button" onClick={onDelete} disabled={busy} className="text-xs font-bold text-son hover:underline">Xóa</button> : null}</div></div>
    </form>
  </section>;
}

function MediaEditRow({ item, busy, onSubmit, onDelete }: { item: CampaignMedia; busy: string | null; onSubmit: (formData: FormData) => void; onDelete: () => void }) {
  return <details className="rounded-[8px] border border-line p-3"><summary className="cursor-pointer text-sm font-bold text-chamDeep">{item.title || item.slot || "Video"} · {item.slot ?? ""}</summary><form action={onSubmit} className="mt-3 grid gap-2 md:grid-cols-2"><input type="hidden" name="campaignId" value={item.campaign_id} /><input type="hidden" name="mediaId" value={item.id} /><input type="hidden" name="mediaType" value="video" /><input type="hidden" name="slot" value={item.slot ?? "start"} /><input name="title" defaultValue={item.title} required maxLength={180} className="rounded-[6px] border border-line px-2 py-1.5 text-sm" /><input name="url" type="url" defaultValue={item.url} required className="rounded-[6px] border border-line px-2 py-1.5 text-sm" /><input name="thumbnailUrl" type="url" defaultValue={item.thumbnail_url ?? ""} placeholder="Thumbnail URL" className="rounded-[6px] border border-line px-2 py-1.5 text-sm" /><input name="sortOrder" type="number" min={0} defaultValue={item.sort_order} className="rounded-[6px] border border-line px-2 py-1.5 text-sm" /><div className="flex items-center justify-between gap-3 md:col-span-2"><PublicCheckbox name="isPublic" label="Hiển thị công khai" checked={item.is_public} /><div className="flex gap-3"><button type="submit" disabled={busy !== null} className="rounded-[6px] bg-sky px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? "Đang lưu…" : "Cập nhật"}</button><button type="button" onClick={onDelete} disabled={busy !== null} className="text-xs font-bold text-son hover:underline">Xóa</button></div></div></form></details>;
}

function UpdateEditRow({ item, busy, onSubmit, onDelete }: { item: CampaignUpdate; busy: string | null; onSubmit: (formData: FormData) => void; onDelete: () => void }) {
  return <details className="rounded-[8px] border border-line p-3"><summary className="cursor-pointer text-sm font-bold text-chamDeep">{item.title} · {new Date(item.event_at).toLocaleDateString("vi-VN")}</summary><form action={onSubmit} className="mt-3 grid gap-2 md:grid-cols-2"><input type="hidden" name="campaignId" value={item.campaign_id} /><input type="hidden" name="updateId" value={item.id} /><input name="title" defaultValue={item.title} required maxLength={180} className="rounded-[6px] border border-line px-2 py-1.5 text-sm" /><select name="updateType" defaultValue={item.update_type} className="rounded-[6px] border border-line px-2 py-1.5 text-sm"><option value="general">Cập nhật chung</option><option value="start">Bắt đầu triển khai</option><option value="mid">Cập nhật giữa kỳ</option><option value="handover">Kết quả bàn giao</option></select><textarea name="body" defaultValue={item.body} required maxLength={10000} rows={3} className="rounded-[6px] border border-line px-2 py-1.5 text-sm md:col-span-2" /><input name="locationText" defaultValue={item.location_text ?? ""} placeholder="Địa điểm" className="rounded-[6px] border border-line px-2 py-1.5 text-sm" /><input name="eventAt" type="datetime-local" defaultValue={dateTimeLocal(item.event_at)} className="rounded-[6px] border border-line px-2 py-1.5 text-sm" /><div className="flex items-center justify-between gap-3 md:col-span-2"><PublicCheckbox name="isPublic" label="Hiển thị công khai" checked={item.is_public} /><div className="flex gap-3"><button type="submit" disabled={busy !== null} className="rounded-[6px] bg-sky px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? "Đang lưu…" : "Cập nhật"}</button><button type="button" onClick={onDelete} disabled={busy !== null} className="text-xs font-bold text-son hover:underline">Xóa</button></div></div></form></details>;
}
