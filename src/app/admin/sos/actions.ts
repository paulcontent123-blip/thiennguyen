"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";
import { distanceKm } from "@/lib/geo/distance";

export type SosDispatchResult = { ok: true; message: string; campaignId?: string } | { ok: false; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh(reportId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/sos");
  revalidatePath(`/admin/sos/${reportId}`);
  revalidatePath("/rescue/operations");
}

export async function alertNearestVolunteer(reportId: string): Promise<SosDispatchResult> {
  const { supabase } = await requireActionRole(["admin"]);
  if (!UUID_PATTERN.test(reportId)) return { ok: false, message: "Báo cáo không hợp lệ." };
  const { data: report, error: reportError } = await supabase
    .from("sos_reports")
    .select("id, latitude, longitude, status")
    .eq("id", reportId)
    .maybeSingle();
  if (reportError || !report || !["urgent", "needs_support"].includes(report.status)) {
    return { ok: false, message: "Chỉ có thể điều phối SOS đã xác minh và đang cần hỗ trợ." };
  }
  if (report.latitude === null || report.longitude === null) {
    return { ok: false, message: "SOS chưa có GPS; không thể xác định tình nguyện viên gần nhất." };
  }

  const { data: volunteers, error } = await supabase
    .from("rescue_teams")
    .select("id, name, latitude, longitude, radius_km")
    .eq("member_kind", "volunteer")
    .eq("status", "available")
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  if (error) return { ok: false, message: error.message };

  const nearest = (volunteers ?? [])
    .flatMap((volunteer) => {
      if (volunteer.latitude === null || volunteer.longitude === null || volunteer.radius_km === null) return [];
      const km = distanceKm(report.latitude, report.longitude, volunteer.latitude, volunteer.longitude);
      return km <= volunteer.radius_km ? [{ ...volunteer, km }] : [];
    })
    .sort((a, b) => a.km - b.km)[0];
  if (!nearest) return { ok: false, message: "Không có tình nguyện viên sẵn sàng trong bán kính đã đăng ký." };

  const { error: alertError } = await supabase.from("sos_team_alerts").upsert({
    sos_report_id: reportId,
    rescue_team_id: nearest.id,
    distance_km: nearest.km,
    source: "admin",
  }, { onConflict: "sos_report_id,rescue_team_id", ignoreDuplicates: true });
  if (alertError) return { ok: false, message: alertError.message };
  refresh(reportId);
  return { ok: true, message: `Đã báo ${nearest.name} (${nearest.km.toFixed(1)} km). Nếu đã có cảnh báo tự động, hệ thống không gửi trùng.` };
}

export async function updateSosCoordinates(reportId: string, formData: FormData): Promise<SosDispatchResult> {
  const { supabase } = await requireActionRole(["admin"]);
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  if (!UUID_PATTERN.test(reportId)
    || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, message: "Tọa độ GPS không hợp lệ." };
  }
  const { error } = await supabase.from("sos_reports").update({ latitude, longitude }).eq("id", reportId);
  if (error) return { ok: false, message: error.message };
  refresh(reportId);
  revalidatePath("/sos");
  return { ok: true, message: "Đã cập nhật GPS. SOS đã xác minh sẽ tự phát cảnh báo cho đội trong bán kính." };
}

export async function coordinateSosTransport(reportId: string, offerId: string): Promise<SosDispatchResult> {
  const { supabase } = await requireActionRole(["admin"]);
  if (!UUID_PATTERN.test(reportId) || !UUID_PATTERN.test(offerId)) return { ok: false, message: "Dữ liệu điều phối không hợp lệ." };
  const { data, error } = await supabase.rpc("coordinate_sos_transport", { p_sos_report_id: reportId, p_offer_id: offerId });
  if (error || !data) return { ok: false, message: error?.message ?? "Xe không còn phù hợp để điều phối." };
  refresh(reportId);
  return { ok: true, message: "Đã ghi nhận liên hệ điều phối xe. Hãy liên hệ người đăng và cập nhật kết quả." };
}

export async function updateSosTransportDispatch(dispatchId: string, status: "accepted" | "declined" | "completed", reportId: string): Promise<SosDispatchResult> {
  const { supabase } = await requireActionRole(["admin"]);
  if (!UUID_PATTERN.test(dispatchId) || !UUID_PATTERN.test(reportId)) return { ok: false, message: "Lượt điều phối không hợp lệ." };
  const { error } = await supabase.from("sos_transport_dispatches").update({ status }).eq("id", dispatchId).eq("sos_report_id", reportId);
  if (error) return { ok: false, message: error.message };
  refresh(reportId);
  return { ok: true, message: "Đã cập nhật kết quả điều phối xe." };
}

export async function createSosEmergencyCampaign(reportId: string, formData: FormData): Promise<SosDispatchResult> {
  const { supabase } = await requireActionRole(["admin"]);
  const organizationId = String(formData.get("organizationId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const targetAmount = Number(formData.get("targetAmount"));
  if (!UUID_PATTERN.test(reportId) || !UUID_PATTERN.test(organizationId)
    || title.length < 8 || title.length > 180
    || !Number.isInteger(targetAmount) || targetAmount < 100000 || targetAmount > 100000000000) {
    return { ok: false, message: "Tổ chức, tiêu đề hoặc mục tiêu gây quỹ chưa hợp lệ." };
  }
  const { data, error } = await supabase.rpc("create_sos_emergency_campaign", {
    p_sos_report_id: reportId,
    p_organization_id: organizationId,
    p_title: title,
    p_target_amount: targetAmount,
  });
  if (error || !data) return { ok: false, message: error?.message ?? "Không thể tạo chiến dịch." };
  refresh(reportId);
  revalidatePath("/organization");
  return { ok: true, campaignId: String(data), message: "Đã tạo chiến dịch bản nháp. Tổ chức cần hoàn thiện và gửi duyệt trước khi công khai/nhận tiền." };
}

export async function rejectSosCampaignRequest(reportId: string, note: string): Promise<SosDispatchResult> {
  const { supabase, user } = await requireActionRole(["admin"]);
  if (!UUID_PATTERN.test(reportId) || note.trim().length < 5) return { ok: false, message: "Cần nhập lý do từ chối (ít nhất 5 ký tự)." };
  const { data, error } = await supabase.from("sos_campaign_requests")
    .update({ status: "rejected", review_note: note.trim().slice(0, 1000), reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("sos_report_id", reportId)
    .eq("status", "pending_review")
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: error?.message ?? "Không còn đề xuất chờ duyệt." };
  refresh(reportId);
  return { ok: true, message: "Đã từ chối đề xuất gây quỹ." };
}

export async function closeSosReport(reportId: string): Promise<SosDispatchResult> {
  const { supabase, user } = await requireActionRole(["admin"]);
  if (!UUID_PATTERN.test(reportId)) return { ok: false, message: "Báo cáo không hợp lệ." };
  const { data, error } = await supabase.from("sos_reports")
    .update({ status: "handled", handled_at: new Date().toISOString(), handled_by: user.id })
    .eq("id", reportId)
    .in("status", ["urgent", "needs_support"])
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "SOS này không còn ở trạng thái đang cần hỗ trợ." };
  refresh(reportId);
  revalidatePath("/sos");
  return { ok: true, message: "Đã đóng SOS (đánh dấu đã xử lý)." };
}

export async function setSosAutoClose(reportId: string, enabled: boolean): Promise<SosDispatchResult> {
  const { supabase } = await requireActionRole(["admin"]);
  if (!UUID_PATTERN.test(reportId)) return { ok: false, message: "Báo cáo không hợp lệ." };
  const { error } = await supabase.from("sos_reports").update({ auto_close_on_team_complete: enabled }).eq("id", reportId);
  if (error) return { ok: false, message: error.message };
  refresh(reportId);
  return { ok: true, message: enabled ? "Đã bật: SOS tự đóng khi đội báo xử lý xong." : "Đã tắt tự đóng: Admin sẽ xác nhận đóng SOS." };
}
