"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleCampaignFollow } from "@/app/campaigns/follow-actions";
import type { CampaignFollowState } from "@/lib/campaigns/follows";

type Props = {
  campaignId: string;
  campaignSlug: string;
  initialState: CampaignFollowState;
  viewer: "guest" | "donor" | "other";
  compact?: boolean;
};

export function CampaignFollowButton({ campaignId, campaignSlug, initialState, viewer, compact = false }: Props) {
  const [followed, setFollowed] = useState(initialState.followed);
  const [count, setCount] = useState(initialState.count);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const buttonClass = `inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${followed ? "border-son bg-sonSoft text-son" : "border-lineStrong bg-white text-inkMid hover:border-son hover:text-son"}`;
  const label = followed ? "Đang theo dõi" : "Theo dõi";
  const content = <><span aria-hidden="true">{followed ? "♥" : "♡"}</span><span>{compact ? count : `${label} · ${count}`}</span></>;

  if (viewer === "guest") {
    return <Link href={`/login?next=${encodeURIComponent(`/campaigns/${campaignSlug}`)}`} className={buttonClass} title="Đăng nhập để theo dõi chiến dịch" aria-label="Đăng nhập để theo dõi chiến dịch">{content}</Link>;
  }

  if (viewer === "other") {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-lineStrong bg-white px-3 py-1.5 text-xs text-inkSoft" title="Chỉ nhà hảo tâm có thể theo dõi chiến dịch">♡ {compact ? count : `${count} lượt theo dõi`}</span>;
  }

  function handleClick() {
    if (isPending) return;
    const oldFollowed = followed;
    const oldCount = count;
    const nextFollowed = !followed;
    setFollowed(nextFollowed);
    setCount((value) => Math.max(0, value + (nextFollowed ? 1 : -1)));
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await toggleCampaignFollow(campaignId);
        if (!result.ok) {
          setFollowed(oldFollowed);
          setCount(oldCount);
          setMessage(result.message);
          return;
        }
        setFollowed(result.followed);
        setCount(result.count);
      } catch {
        setFollowed(oldFollowed);
        setCount(oldCount);
        setMessage("Không thể cập nhật theo dõi. Vui lòng thử lại.");
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={handleClick} disabled={isPending} aria-pressed={followed} aria-label={followed ? "Bỏ theo dõi chiến dịch" : "Theo dõi chiến dịch"} className={`${buttonClass} disabled:cursor-wait disabled:opacity-70`}>
        {content}
      </button>
      {message ? <span role="alert" className="max-w-48 rounded bg-white px-2 py-1 text-right text-[11px] text-son shadow-card">{message}</span> : null}
    </span>
  );
}
