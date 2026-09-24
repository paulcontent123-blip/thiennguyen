export type SosTeamResponse = {
  team_name: string;
  member_kind: string;
  progress: string;
  updated_at: string;
};

export const TEAM_PROGRESS: Record<string, { label: string; icon: string; className: string; color: string; bg: string }> = {
  acknowledged: { label: "Đã tiếp nhận", icon: "👀", className: "bg-inkSoft/15 text-inkMid", color: "#5A5F73", bg: "#EEEFF3" },
  en_route: { label: "Đang tới", icon: "🚑", className: "bg-sky/15 text-sky", color: "#3B7DD8", bg: "#DDEAFC" },
  on_scene: { label: "Đã đến hiện trường", icon: "📍", className: "bg-nghe/15 text-ngheDeep", color: "#8B5E0A", bg: "#FFF3E0" },
  completed: { label: "Đã xử lý xong", icon: "✅", className: "bg-lua/15 text-lua", color: "#2E7D32", bg: "#E8F5E9" },
};
