"use client";

import { useState } from "react";
import type { CampaignMedia, CampaignShareSettings, CampaignUpdate } from "@/lib/campaigns/content";

type CampaignDetailTabsProps = {
  title: string;
  createdAt: string;
  publishedAt: string | null;
  status: string;
  updates: CampaignUpdate[];
  videos: CampaignMedia[];
  poster: CampaignMedia | null;
  qrUrl: string | null;
};

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: string | null) {
  return value ? dateTime.format(new Date(value)) : "Chưa cập nhật";
}

export function CampaignDetailTabs({ title, createdAt, publishedAt, status, updates, videos, poster, qrUrl }: CampaignDetailTabsProps) {
  const [tab, setTab] = useState<"timeline" | "video" | "viral">("timeline");

  return (
    <section className="mt-7">
      <div className="flex overflow-x-auto border-b-2 border-line">
        <TabButton active={tab === "timeline"} onClick={() => setTab("timeline")}>📖 Nhật ký thực địa</TabButton>
        <TabButton active={tab === "video"} onClick={() => setTab("video")}>🎥 Video 9:16</TabButton>
        <TabButton active={tab === "viral"} onClick={() => setTab("viral")}>🎈 Viral Kit</TabButton>
      </div>

      {tab === "timeline" ? <Timeline createdAt={createdAt} publishedAt={publishedAt} status={status} updates={updates} /> : null}
      {tab === "video" ? <VideoPanel videos={videos} /> : null}
      {tab === "viral" ? <ViralPanel title={title} poster={poster} qrUrl={qrUrl} /> : null}
    </section>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 border-b-[3px] px-4 py-2 text-[13px] font-semibold transition ${active ? "border-son text-son" : "border-transparent text-inkSoft hover:text-son"}`}
    >
      {children}
    </button>
  );
}

function Timeline({ createdAt, publishedAt, status, updates }: { createdAt: string; publishedAt: string | null; status: string; updates: CampaignUpdate[] }) {
  return (
    <div className="mt-5 flex flex-col">
      <TimelineItem icon="🏛️" title="Hồ sơ chiến dịch được tạo" date={formatDate(createdAt)} text="Thông tin chiến dịch đã được tổ chức gửi lên nền tảng." />
      <TimelineItem
        icon="✓"
        admin
        title={status === "closed" ? "Chiến dịch đã đóng" : "Chiến dịch được Admin phê duyệt"}
        date={formatDate(publishedAt)}
        text={status === "closed" ? "Chiến dịch đã kết thúc tiếp nhận ủng hộ." : "Chiến dịch đủ điều kiện hiển thị công khai."}
        tag="milestone"
      />
      {updates.map((update) => (
        <TimelineItem
          key={update.id}
          icon="📍"
          title={update.title}
          date={formatDate(update.event_at)}
          text={update.location_text ? `${update.body} · ${update.location_text}` : update.body}
        />
      ))}
      {updates.length === 0 ? <div className="rounded-[8px] bg-paper px-4 py-3 text-sm leading-6 text-inkSoft">Nhật ký cập nhật thực địa sẽ xuất hiện tại đây khi tổ chức bổ sung dữ liệu bàn giao, chứng từ hoặc hình ảnh GPS.</div> : null}
    </div>
  );
}

function TimelineItem({ icon, admin = false, title, date, text, tag }: { icon: string; admin?: boolean; title: string; date: string; text: string; tag?: string }) {
  return (
    <article className="relative flex gap-3 pb-5">
      <div className={`relative z-10 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[3px] border-white text-base shadow-[0_0_0_2px_rgba(30,36,56,0.13)] ${admin ? "bg-chamSoft text-cham" : "bg-sonSoft"}`}>
        {icon}
      </div>
      <div className="relative flex-1 rounded-[10px] border border-line bg-white p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="text-[13px] font-bold text-chamDeep">{title}</span>
          <span className="text-[11.5px] text-inkSoft">{date}</span>
        </div>
        {tag ? <span className="mt-1 inline-flex rounded-full bg-skySoft px-2 py-0.5 text-[10.5px] font-bold text-sky">Cột mốc</span> : null}
        <p className="mt-2 text-[13.5px] leading-6 text-ink">{text}</p>
      </div>
    </article>
  );
}

function VideoPanel({ videos }: { videos: CampaignMedia[] }) {
  const defaultLabels: Record<string, string> = {
    start: "Ngày bắt đầu triển khai",
    mid: "Cập nhật giữa kỳ",
    handover: "Kết quả bàn giao",
  };

  return (
    <div className="mt-5">
      <p className="mb-3 text-[13.5px] leading-6 text-inkMid">Video cập nhật từ thực địa - tỷ lệ 9:16, phù hợp Story Zalo/Facebook/TikTok.</p>
      {videos.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {videos.map((video) => (
            <a key={video.id} href={video.url} target="_blank" rel="noreferrer" className="relative flex aspect-[9/16] flex-col items-center justify-center gap-2 overflow-hidden rounded-[10px] bg-[#10232a] p-4 text-center text-white hover:opacity-90">
              {video.thumbnail_url ? <img src={video.thumbnail_url} alt={video.alt_text || video.title} className="absolute inset-0 h-full w-full object-cover opacity-60" /> : null}
              <div className="relative z-10 text-4xl opacity-80">▶</div>
              <div className="relative z-10 text-xs font-semibold">{video.title || defaultLabels[video.slot ?? ""] || "Video cập nhật"}</div>
              <div className="relative z-10 text-[11px] text-white/75">Mở video ↗</div>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-[8px] bg-paper px-4 py-5 text-sm text-inkSoft">Chưa có video công khai cho chiến dịch này.</div>
      )}
      <div className="mt-4 rounded-[8px] bg-paper px-3 py-2.5 text-[13px] leading-6 text-inkMid">💡 Video được quản lý từ cổng tổ chức và chỉ hiển thị sau khi tổ chức đánh dấu công khai.</div>
    </div>
  );
}

function ViralPanel({ title, poster, qrUrl }: { title: string; poster: CampaignMedia | null; qrUrl: string | null }) {
  return (
    <div className="mt-5">
      <div className="rounded-[14px] bg-gradient-to-br from-son to-[#D4514A] p-5 text-white">
        <div className="font-serif text-xl">🎈 Viral Kit - Chia sẻ để lan tỏa</div>
        <p className="mt-1.5 text-[13.5px] leading-6 text-white/75">Poster 9:16 và mã VietQR được lấy từ nội dung đã được tổ chức cấu hình cho chiến dịch.</p>
        <div className="mt-4 flex items-center gap-3 rounded-[10px] bg-white/10 p-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-paper text-3xl">
            {poster ? <img src={poster.url} alt={poster.alt_text || title} className="h-full w-full object-cover" /> : "📷"}
          </div>
          <div>
            <div className="text-sm font-bold">Poster: {title}</div>
            <div className="text-xs text-white/65">{poster ? "Poster đã được lưu" : "Chưa có poster được upload"}</div>
          </div>
        </div>
        {poster ? <a href={poster.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-son">⇩ Tải Poster 9:16</a> : <span className="mt-3 inline-flex rounded-full bg-white/70 px-4 py-2 text-sm font-bold text-son">⇩ Tải Poster 9:16 · Chưa có</span>}
        {qrUrl ? <div className="mt-4 flex items-center gap-3 rounded-[10px] bg-white p-3 text-chamDeep"><img src={qrUrl} alt="VietQR của chiến dịch" className="h-28 w-28 rounded bg-white object-contain" /><div><div className="text-sm font-bold">VietQR động</div><div className="mt-1 text-xs text-inkSoft">QR được sinh theo cấu hình tài khoản của chiến dịch.</div></div></div> : null}
      </div>
      <div className="mt-3 rounded-[8px] border border-dashed border-lineStrong bg-paper px-3 py-2.5 font-mono text-xs text-inkSoft">Schema.org LiveBlogPosting sẽ được render từ cấu hình SEO đã lưu.</div>
    </div>
  );
}

export function CampaignShare({ title, compact = false, settings }: { title: string; compact?: boolean; settings?: CampaignShareSettings | null }) {
  async function copyLink() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
    }
  }

  function openFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, "_blank", "noopener,noreferrer");
  }

  function openZalo() {
    window.open(`https://zalo.me/share?u=${encodeURIComponent(window.location.href)}`, "_blank", "noopener,noreferrer");
  }

  const shareTitle = settings?.share_title || title;
  const zaloEnabled = settings?.zalo_enabled ?? true;
  const facebookEnabled = settings?.facebook_enabled ?? true;
  const copyEnabled = settings?.copy_enabled ?? true;

  return (
    <div className={compact ? "mt-3" : "mt-5 rounded-[10px] border border-line bg-paper p-4"}>
      {!compact ? <div className="mb-2 text-[13.5px] font-bold text-chamDeep">{settings?.share_title || "Chia sẻ để lan tỏa chiến dịch"}</div> : null}
      <div className={compact ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
        {zaloEnabled ? <button type="button" onClick={openZalo} className="inline-flex items-center justify-center gap-1.5 rounded-[8px] bg-[#0068FF] px-3.5 py-2 text-xs font-bold text-white">Zalo</button> : null}
        {facebookEnabled ? <button type="button" onClick={openFacebook} className="inline-flex items-center justify-center gap-1.5 rounded-[8px] bg-[#1877F2] px-3.5 py-2 text-xs font-bold text-white">Facebook</button> : null}
        {copyEnabled ? <button type="button" onClick={copyLink} className="inline-flex items-center justify-center gap-1.5 rounded-[8px] border border-lineStrong bg-white px-3.5 py-2 text-xs font-bold text-ink">🔗 Sao chép link</button> : null}
        <span className="sr-only">{shareTitle}</span>
      </div>
    </div>
  );
}

