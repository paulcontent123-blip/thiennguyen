"use client";

import dynamic from "next/dynamic";

const SosMap = dynamic(() => import("./sos-map").then((mod) => mod.SosMap), {
  ssr: false,
  loading: () => <div className="flex h-[380px] w-full items-center justify-center bg-paperMid text-sm text-inkSoft sm:h-[520px]">Đang tải bản đồ…</div>,
});

export { SosMap as SosMapLoader };
