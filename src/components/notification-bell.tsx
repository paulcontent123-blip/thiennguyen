"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  category: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const POLL_INTERVAL_MS = 30_000;
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

const categoryIcon: Record<string, string> = {
  payment_pending: "⏳",
  payment_completed: "✅",
  payment_rejected: "⚠️",
  campaign_status: "📢",
  resource_update: "📦",
  admin_alert: "🔔",
  other: "📨",
};

export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const fetchNotifications = useCallback(async () => {
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, category, title, body, link, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null),
    ]);
    setItems(data ?? []);
    setUnreadCount(count ?? 0);
  }, [supabase, userId]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function markRead(id: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item)));
    setUnreadCount((current) => Math.max(0, current - 1));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setLoading(true);
    setItems((current) => current.map((item) => (item.read_at ? item : { ...item, read_at: new Date().toISOString() })));
    setUnreadCount(0);
    // Không giới hạn theo danh sách đang hiển thị (chỉ tải 30 thông báo mới nhất) — phải cập nhật
    // TOÀN BỘ thông báo chưa đọc của người dùng, kể cả những thông báo cũ hơn 30 cái gần nhất.
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    await fetchNotifications();
    setLoading(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          if (!open) fetchNotifications();
        }}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-lineStrong text-lg text-chamDeep transition hover:border-son hover:text-son"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-son px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open && mounted
        ? createPortal(
            <div
              style={{
                position: "fixed",
                top: (wrapperRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
                right: Math.max(8, window.innerWidth - (wrapperRef.current?.getBoundingClientRect().right ?? 0)),
              }}
              className="z-50 w-[min(92vw,380px)] overflow-hidden rounded-[10px] border border-line bg-white shadow-modal"
            >
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                <p className="text-sm font-bold text-chamDeep">Thông báo</p>
                {unreadCount > 0 ? (
                  <button type="button" onClick={markAllRead} disabled={loading} className="text-xs font-bold text-sky hover:underline disabled:opacity-50">
                    Đánh dấu tất cả đã đọc
                  </button>
                ) : null}
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-inkSoft">Chưa có thông báo nào.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {items.map((item) => {
                      const content = (
                        <div className={`flex gap-3 px-4 py-3 text-left transition hover:bg-paper ${!item.read_at ? "bg-ngheXsoft" : ""}`}>
                          <span aria-hidden className="text-lg">{categoryIcon[item.category] ?? "📨"}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-bold text-chamDeep">{item.title}</span>
                            {item.body ? <span className="mt-0.5 block whitespace-pre-wrap text-xs leading-5 text-inkMid">{item.body}</span> : null}
                            <span className="mt-1 block text-[11px] text-inkSoft">{dateTime.format(new Date(item.created_at))}</span>
                          </span>
                          {!item.read_at ? <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-son" /> : null}
                        </div>
                      );
                      return (
                        <li key={item.id}>
                          {item.link ? (
                            <Link
                              href={item.link}
                              onClick={() => {
                                if (!item.read_at) markRead(item.id);
                                setOpen(false);
                              }}
                              className="block"
                            >
                              {content}
                            </Link>
                          ) : (
                            <button type="button" onClick={() => markRead(item.id)} className="block w-full">
                              {content}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
