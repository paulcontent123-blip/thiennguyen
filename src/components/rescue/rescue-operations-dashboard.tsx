"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeSosAlert, updateRescueLocation, updateRescueStatus } from "@/app/rescue/operations/actions";
import { SosProgressPanel } from "@/components/rescue/sos-progress-panel";
import { createClient } from "@/lib/supabase/client";

type RescueTeam = {
  id: string;
  name: string;
  resource_types: string[];
  province: string | null;
  radius_km: number | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
};

type SosTask = {
  alertId: string;
  distanceKm: number;
  acknowledgedAt: string | null;
  responseStatus: string | null;
  responseNote: string | null;
  id: string;
  location_text: string;
  description: string | null;
  needs: string[];
  status: string;
  created_at: string;
};

const statusOptions: { value: string; label: string; className: string }[] = [
  { value: "available", label: "Sẵn sàng", className: "bg-lua text-white" },
  { value: "en_route", label: "Đang di chuyển", className: "bg-nghe text-white" },
  { value: "busy", label: "Đang bận", className: "bg-son text-white" },
  { value: "inactive", label: "Ngừng hoạt động", className: "bg-inkSoft text-white" },
];

const sosStatusLabels: Record<string, { label: string; className: string }> = {
  urgent: { label: "Khẩn cấp", className: "bg-son/15 text-son" },
  needs_support: { label: "Cần hỗ trợ", className: "bg-nghe/15 text-ngheDeep" },
};

const datetime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function RescueOperationsDashboard({ team, tasks, canEdit }: { team: RescueTeam | null; tasks: SosTask[]; canEdit: boolean }) {
  const router = useRouter();
  const [statusLoading, setStatusLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const teamId = team?.id;

  useEffect(() => {
    if (typeof Notification !== "undefined") setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!teamId || !canEdit) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`sos-team-alerts-${teamId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "sos_team_alerts", filter: `rescue_team_id=eq.${teamId}`,
      }, () => {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Có SOS mới trong bán kính hoạt động", { body: "Mở trang Điều phối cứu trợ để xem chi tiết." });
        }
        router.refresh();
      })
      .subscribe();
    const fallback = window.setInterval(() => router.refresh(), 30_000);
    return () => { window.clearInterval(fallback); void supabase.removeChannel(channel); };
  }, [teamId, canEdit, router]);

  async function acknowledge(alertId: string) {
    setError(null);
    try {
      const result = await acknowledgeSosAlert(alertId);
      if (!result.ok) { setError(result.message); return; }
      setNotice(result.message);
      router.refresh();
    } catch {
      setError("Không thể xác nhận cảnh báo lúc này.");
    }
  }

  async function handleStatusChange(status: string) {
    setStatusLoading(true);
    setError(null);
    const result = await updateRescueStatus(status);
    setStatusLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.message);
    router.refresh();
  }

  function handleUpdateLocation() {
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    setLocationLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const formData = new FormData();
        formData.set("latitude", String(position.coords.latitude));
        formData.set("longitude", String(position.coords.longitude));
        const result = await updateRescueLocation(formData);
        setLocationLoading(false);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setNotice(result.message);
        router.refresh();
      },
      () => {
        setLocationLoading(false);
        setError("Không lấy được vị trí — kiểm tra quyền định vị của trình duyệt.");
      },
    );
  }

  if (!team) {
    return (
      <div className="rounded-[14px] border border-line bg-white p-6 text-sm text-inkMid">
        Tài khoản này chưa gắn với hồ sơ đội cứu trợ nào (có thể đang xem với vai trò Admin).
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-[14px] border border-line bg-white p-5">
          <h2 className="font-serif text-lg font-semibold text-chamDeep">{team.name}</h2>
          <p className="mt-1 text-xs text-inkSoft">
            {team.province ?? "Chưa có khu vực"} · bán kính {team.radius_km ?? "—"}km
            <span className="block text-[11px]">(chỉ Admin thay đổi được khu vực/bán kính)</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {team.resource_types.map((type) => (
              <span key={type} className="rounded-[4px] bg-paperDeep px-2 py-0.5 text-xs font-semibold text-inkMid">
                {type}
              </span>
            ))}
          </div>
        </div>

        {canEdit ? (
          <div className="rounded-[14px] border border-line bg-white p-5">
            {notice ? <p className="mb-3 rounded-[8px] bg-lua/10 p-2.5 text-xs text-lua">{notice}</p> : null}
            {error ? <p className="mb-3 rounded-[8px] bg-son/10 p-2.5 text-xs text-son">{error}</p> : null}

            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-inkSoft">Trạng thái hoạt động</p>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={statusLoading || team.status === option.value}
                  onClick={() => handleStatusChange(option.value)}
                  className={`rounded-[8px] px-3 py-2 text-xs font-bold transition disabled:cursor-default ${
                    team.status === option.value ? option.className : "border border-line bg-white text-inkMid hover:border-son hover:text-son"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-inkSoft">Vị trí hiện tại</p>
              <p className="text-xs text-inkMid">
                {team.latitude !== null && team.longitude !== null ? `${team.latitude.toFixed(4)}, ${team.longitude.toFixed(4)}` : "Chưa cập nhật"}
              </p>
              <button type="button" onClick={handleUpdateLocation} disabled={locationLoading} className="button-secondary mt-2 w-full">
                {locationLoading ? "Đang lấy vị trí…" : "📍 Cập nhật vị trí GPS"}
              </button>
              {notificationPermission === "default" ? (
                <button type="button" onClick={() => void Notification.requestPermission().then(setNotificationPermission)} className="mt-3 text-xs font-semibold text-sky hover:underline">Bật thông báo trên trình duyệt</button>
              ) : null}
            </div>
          </div>
        ) : null}
      </aside>

      <div>
        <h2 className="mb-3 font-serif text-lg font-semibold text-chamDeep">SOS trong bán kính ({tasks.length})</h2>
        <p className="mb-4 text-xs text-inkSoft">
          Chỉ hiển thị SOS đang cần hỗ trợ, có GPS và nằm trong bán kính của đội. Báo cáo của khách phải qua Admin trước; báo cáo từ tài khoản đăng nhập đang dùng luồng xác nhận hiện có. Trình duyệt tự kiểm tra lại mỗi 30 giây khi mất kết nối.
        </p>
        {tasks.length === 0 ? (
          <div className="rounded-[14px] border-2 border-dashed border-lineStrong bg-paperMid p-10 text-center text-sm text-inkMid">
            Không có nhiệm vụ SOS nào đang chờ.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tasks.map((task) => {
              const status = sosStatusLabels[task.status] ?? { label: task.status, className: "bg-inkSoft/15 text-inkSoft" };
              return (
                <div key={task.id} className="rounded-[14px] border border-line bg-white p-4">
                  <span className={`rounded-[4px] px-2 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
                  <h3 className="mt-2 font-serif text-base font-semibold text-chamDeep">{task.location_text}</h3>
                  <p className="mt-1 text-xs font-semibold text-sky">Cách vị trí đội {task.distanceKm.toFixed(1)} km</p>
                  {task.description ? <p className="mt-1 line-clamp-2 text-xs text-inkMid">{task.description}</p> : null}
                  {task.needs.length ? <p className="mt-2 text-xs font-semibold text-sky">{task.needs.join(", ")}</p> : null}
                  <p className="mt-2 text-[11px] text-inkSoft">{datetime.format(new Date(task.created_at))}</p>
                  {canEdit ? task.acknowledgedAt ? (
                    <>
                      <p className="mt-2 text-xs font-semibold text-lua">✓ Đã xem cảnh báo</p>
                      <SosProgressPanel
                        alertId={task.alertId}
                        responseStatus={task.responseStatus}
                        responseNote={task.responseNote}
                        onResult={(result) => { if (result.ok) { setError(null); setNotice(result.message); router.refresh(); } else { setError(result.message); } }}
                      />
                    </>
                  ) : (
                    <button type="button" onClick={() => void acknowledge(task.alertId)} className="button-secondary mt-3 text-xs">Xác nhận đã xem</button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
