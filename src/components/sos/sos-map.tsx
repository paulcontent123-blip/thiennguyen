"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type SosMapReport = {
  id: string;
  location_text: string;
  description: string | null;
  needs: string[];
  status: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
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

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function SosMap({ reports }: { reports: SosMapReport[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [16.5, 106.5],
      zoom: 6,
      minZoom: 5,
      maxZoom: 16,
      maxBounds: [[5, 97], [25, 120]],
    });
    mapRef.current = map;

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
      maxZoom: 18,
    }).addTo(map);

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
              <span class="text-[9px] font-black text-white">SOS</span>
            </div>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        });

        const popupHtml = `<div style="font-family:'Times New Roman',Times,serif;min-width:200px">
          <div style="font-weight:700;font-size:13.5px;color:#1B2444;margin-bottom:4px;">🚨 ${escapeHtml(report.location_text)}</div>
          <span style="display:inline-block;background:${color}22;color:${color};font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-bottom:6px;">${statusLabel[report.status] ?? report.status}</span>
          ${report.needs?.length ? `<div style="font-size:12px;color:#1E2438;margin-top:4px;"><strong>${escapeHtml(report.needs.join(", "))}</strong></div>` : ""}
          ${report.description ? `<div style="font-size:12px;color:rgba(30,36,56,0.65);margin-top:4px;">${escapeHtml(report.description)}</div>` : ""}
          <div style="font-size:11px;color:rgba(30,36,56,0.42);margin-top:6px;">${datetime.format(new Date(report.created_at))}</div>
        </div>`;

        const marker = L.marker([report.latitude as number, report.longitude as number], { icon }).addTo(map).bindPopup(popupHtml, { maxWidth: 260 });
        markers.push(marker);
      });

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [reports]);

  return <div ref={containerRef} className="h-[420px] w-full rounded-[14px] sm:h-[520px]" />;
}
