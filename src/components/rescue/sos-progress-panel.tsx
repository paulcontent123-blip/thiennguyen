"use client";

import { useState } from "react";
import { reportSosProgress } from "@/app/rescue/operations/actions";

const options = [
  { value: "en_route", label: "Đang tới", className: "border-sky text-sky hover:bg-sky/10" },
  { value: "on_scene", label: "Đã đến hiện trường", className: "border-nghe text-ngheDeep hover:bg-nghe/10" },
  { value: "completed", label: "Đã xử lý xong", className: "border-lua text-lua hover:bg-lua/10" },
  { value: "cannot_assist", label: "Không hỗ trợ được", className: "border-son text-son hover:bg-son/10" },
] as const;

const labels: Record<string, string> = Object.fromEntries(options.map((item) => [item.value, item.label]));

export function SosProgressPanel({ alertId, responseStatus, responseNote, onResult }: {
  alertId: string;
  responseStatus: string | null;
  responseNote: string | null;
  onResult: (result: { ok: boolean; message: string }) => void;
}) {
  const [note, setNote] = useState(responseNote ?? "");
  const [loading, setLoading] = useState<string | null>(null);

  async function send(status: string) {
    setLoading(status);
    try {
      onResult(await reportSosProgress(alertId, status, note));
    } catch {
      onResult({ ok: false, message: "Không thể gửi cập nhật lúc này." });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-xs font-bold text-chamDeep">
        Báo tình hình cho Admin{responseStatus ? <span className="ml-1 font-normal text-inkMid">· Hiện tại: <strong className="text-chamDeep">{labels[responseStatus] ?? responseStatus}</strong></span> : null}
      </p>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Ghi chú tình hình (bắt buộc nếu không hỗ trợ được)"
        className="mt-2 w-full rounded-[8px] border border-line px-3 py-2 text-xs outline-none focus:border-son"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={loading !== null}
            onClick={() => void send(item.value)}
            className={`rounded-full border px-3 py-1 text-[11.5px] font-bold transition disabled:cursor-wait disabled:opacity-60 ${item.className} ${responseStatus === item.value ? "bg-white shadow-[inset_0_0_0_1px_currentColor]" : "bg-white"}`}
          >
            {loading === item.value ? "Đang gửi…" : item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
