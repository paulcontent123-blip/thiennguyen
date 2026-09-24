"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TEAM_PROGRESS, type SosTeamResponse } from "@/lib/sos/team-progress";

type SosMapReport = {
  id: string;
  location_text: string;
  description: string | null;
  needs: string[];
  status: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  team_responses?: SosTeamResponse[];
};

const statusColor: Record<string, string> = {
  urgent: "#A8342B",
  needs_support: "#E0972F",
  handled: "#5D7A4B",
};

const statusLabel: Record<string, string> = {
  urgent: "Khẩn cấp",
  needs_support: "Cần hỗ trợ",
  handled: "Đã xử lý",
};

const datetime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const statusPill: Record<string, { bg: string; fg: string }> = {
  urgent: { bg: "#FDECEA", fg: "#A8342B" },
  needs_support: { bg: "#FFF3E0", fg: "#8B5E0A" },
  handled: { bg: "#E8F5E9", fg: "#2E7D32" },
};

function relativeTime(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

function teamResponsesHtml(responses: SosTeamResponse[] | undefined) {
  if (!responses?.length) return "";
  const rows = responses.map((response) => {
    const progress = TEAM_PROGRESS[response.progress] ?? TEAM_PROGRESS.acknowledged;
    return `<div style="margin-top:3px;font-size:12px;">${response.member_kind === "team" ? "🚑" : "🙋"} <strong>${escapeHtml(response.team_name)}</strong> <span style="display:inline-block;background:${progress.bg};color:${progress.color};font-size:11px;font-weight:700;padding:1px 7px;border-radius:20px;">${progress.icon} ${progress.label}</span></div>`;
  }).join("");
  return `<div style="margin-bottom:6px;padding-top:6px;border-top:1px solid #eee;"><div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;">Đội cứu trợ phản hồi</div>${rows}</div>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function SosMap({ reports }: { reports: SosMapReport[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      minZoom: 5,
      maxZoom: 16,
      zoomSnap: 0.25,
      maxBounds: [[5, 97], [25, 120]],
      fadeAnimation: false,
    });
    map.fitBounds([[8.2, 102.0], [23.5, 110.0]]);
    mapRef.current = map;

    const tileOptions = { updateWhenIdle: true, keepBuffer: 1, maxZoom: 16 };
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      ...tileOptions,
      attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    }).addTo(map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", tileOptions).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers: L.Marker[] = [];
    reports
      .filter((report) => report.latitude != null && report.longitude != null)
      .forEach((report) => {
        const color = statusColor[report.status] ?? "#E0972F";
        const icon = L.divIcon({
          className: "",
          html: `<div class="relative h-8 w-8">
            <span class="absolute inset-0 rounded-full opacity-25 animate-ping" style="background:${color}"></span>
            <div class="absolute inset-1 flex items-center justify-center rounded-full border-2 border-white shadow-md" style="background:${color}">
              <span class="text-[11px] font-black text-white">SOS</span>
            </div>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        });

        const pill = statusPill[report.status] ?? { bg: "#F5F0E2", fg: "#1E2438" };
        const popupHtml = `<div style="font-family:'Times New Roman',Times,serif;font-size:13.5px;line-height:1.6;min-width:220px">
          <div style="font-weight:700;font-size:15px;color:#1B2444;margin-bottom:5px;">🚨 ${escapeHtml(report.location_text)}</div>
          <span style="display:inline-block;background:${pill.bg};color:${pill.fg};font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;margin-bottom:8px;">${statusLabel[report.status] ?? escapeHtml(report.status)}</span>
          ${report.needs?.length ? `<div style="font-size:12px;color:#666;margin-bottom:6px;">📍 <strong>${escapeHtml(report.needs.join(", "))}</strong></div>` : ""}
          ${report.description ? `<div style="font-size:12px;color:#666;margin-bottom:6px;">${escapeHtml(report.description)}</div>` : ""}
          ${teamResponsesHtml(report.team_responses)}
          <div style="font-size:12px;color:#666;">🕒 ${relativeTime(report.created_at)} &nbsp;|&nbsp; ${datetime.format(new Date(report.created_at))}</div>
        </div>`;

        const marker = L.marker([report.latitude as number, report.longitude as number], { icon }).addTo(map).bindPopup(popupHtml, { maxWidth: 260 });
        markers.push(marker);
      });

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [reports]);

  return <div ref={containerRef} className="isolate z-0 h-[380px] w-full sm:h-[520px]" />;
}
