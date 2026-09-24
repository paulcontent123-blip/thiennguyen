"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/server";

export type ResourceActionResult = { ok: true; message: string } | { ok: false; message: string };

const RESOURCE_TYPES = ["item", "skill", "transport"] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function positiveNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function databaseMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : String(error ?? "");
  if (message.includes("RESOURCE_QUANTITY_EXCEEDED")) return "Số lượng đăng ký vượt quá nhu cầu còn lại.";
  if (message.includes("RESOURCE_NEED_NOT_AVAILABLE")) return "Nhu cầu này không còn nhận đăng ký.";
  if (message.includes("RESOURCE_OFFER_NOT_AVAILABLE")) return "Nguồn lực đã được ghép, bị hủy hoặc không đủ số lượng.";
  if (message.includes("RESOURCE_MATCH_FORBIDDEN")) return "Bạn không có quyền điều phối nhu cầu này.";
  if (message.includes("RESOURCE_MATCH_ADMIN_ONLY")) return "Chỉ Admin được xác minh và ghép nguồn lực.";
  if (message.includes("INVALID_RESOURCE_CLAIM_TRANSITION")) return "Không thể chuyển sang trạng thái này từ trạng thái hiện tại.";
  if (message.includes("RESOURCE_OFFER_ALREADY_MATCHED")) return "Nguồn lực đã được ghép nên không thể sửa hoặc hủy trực tiếp.";
  if (message.includes("RESOURCE_NEED_ADMIN_ONLY_REVIEW")) return "Nhu cầu đã có người đăng ký hoặc không còn mở nên không thể sửa.";
  if (message.includes("RESOURCE_OFFER_HIDE_ONLY_CANCELLED")) return "Chỉ ẩn được nguồn lực đã hủy.";
  if (message.includes("RESOURCE_CLAIM_ADMIN_ONLY_REVIEW")) return "Lượt này đã qua xác minh của Admin nên không thể ẩn.";
  return message || "Không thể thực hiện thao tác. Vui lòng thử lại.";
}

function refreshResources(campaignSlug?: string | null) {
  revalidatePath("/donate-items");
  revalidatePath("/admin");
  if (campaignSlug) revalidatePath(`/campaigns/${campaignSlug}`);
}

async function requireCampaignManager(campaignId: string) {
  const auth = await requireActionRole(["donor", "org", "admin"]);
  const { data: campaign, error } = await auth.supabase
    .from("campaigns")
    .select("id, slug, status, owner_type, owner_user_id, organization_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (error || !campaign) throw new Error("Không tìm thấy chiến dịch.");
  let allowed = auth.role === "admin";
  if (auth.role === "donor") allowed = campaign.owner_type === "individual" && campaign.owner_user_id === auth.user.id;
  if (auth.role === "org") {
    const { data: organization } = await auth.supabase
      .from("organizations")
      .select("id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    allowed = Boolean(organization && organization.id === campaign.organization_id);
  }
  if (!allowed) throw new Error("Bạn không có quyền quản lý nguồn lực của chiến dịch này.");
  return { ...auth, campaign };
}

async function requireNeedManager(needId: string) {
  const auth = await requireActionRole(["donor", "org", "admin"]);
  const { data: need, error } = await auth.supabase
    .from("resource_needs")
    .select("id, campaign_id, campaigns(slug)")
    .eq("id", needId)
    .maybeSingle();
  if (error || !need) throw new Error("Không tìm thấy nhu cầu nguồn lực.");
  const manager = await requireCampaignManager(need.campaign_id);
  return { ...manager, need };
}

export async function createResourceOffer(formData: FormData): Promise<ResourceActionResult> {
  try {
    const { supabase, user } = await requireActionRole(["donor", "org", "rescue_team", "admin"]);
    const resourceType = text(formData, "resourceType");
    const title = text(formData, "title");
    const description = text(formData, "description");
    const quantity = positiveNumber(formData, "quantity");
    const unit = text(formData, "unit");
    const province = text(formData, "province");
    const availableFrom = text(formData, "availableFrom");
    const preferredCampaignId = text(formData, "preferredCampaignId");
    const contactName = text(formData, "contactName");
    const contactEmail = text(formData, "contactEmail").toLowerCase();
    const contactPhone = text(formData, "contactPhone");
    const estimatedValue = text(formData, "estimatedValue");
    const radius = text(formData, "radiusKm");
    const latitudeRaw = text(formData, "latitude");
    const longitudeRaw = text(formData, "longitude");

    if (!RESOURCE_TYPES.includes(resourceType as (typeof RESOURCE_TYPES)[number])) {
      return { ok: false, message: "Loại nguồn lực không hợp lệ." };
    }
    if (title.length < 2 || title.length > 180 || description.length > 2000 || !quantity || !unit || unit.length > 40) {
      return { ok: false, message: "Tên, số lượng hoặc đơn vị nguồn lực chưa hợp lệ." };
    }
    if (contactName.length < 2 || contactName.length > 120 || !EMAIL_PATTERN.test(contactEmail)) {
      return { ok: false, message: "Tên và email liên hệ chưa hợp lệ." };
    }
    const estimatedValueVnd = estimatedValue ? Number(estimatedValue) : null;
    const radiusKm = radius ? Number(radius) : null;
    if (estimatedValueVnd !== null && (!Number.isFinite(estimatedValueVnd) || estimatedValueVnd < 0)) {
      return { ok: false, message: "Giá trị quy đổi không hợp lệ." };
    }
    if (radiusKm !== null && (!Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > 2000)) {
      return { ok: false, message: "Bán kính phục vụ phải từ 1 đến 2.000 km." };
    }
    const latitude = latitudeRaw ? Number(latitudeRaw) : null;
    const longitude = longitudeRaw ? Number(longitudeRaw) : null;
    if ((latitude === null) !== (longitude === null)
      || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
      || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      return { ok: false, message: "Tọa độ nguồn lực chưa hợp lệ." };
    }
    if (resourceType === "transport" && latitude !== null && radiusKm === null) {
      return { ok: false, message: "Khi đăng vị trí xe để ghép SOS, vui lòng khai báo cả bán kính phục vụ." };
    }

    const { error } = await supabase.from("resource_offers").insert({
      user_id: user.id,
      resource_type: resourceType,
      title,
      description,
      quantity,
      unit,
      estimated_value_vnd: estimatedValueVnd,
      province: province || null,
      available_from: availableFrom || null,
      radius_km: radiusKm,
      latitude: resourceType === "transport" ? latitude : null,
      longitude: resourceType === "transport" ? longitude : null,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone || null,
      preferred_campaign_id: preferredCampaignId || null,
    });
    if (error) return { ok: false, message: databaseMessage(error) };
    refreshResources();
    return { ok: true, message: "Đã ghi nhận nguồn lực. Admin sẽ kiểm tra và ghép với nhu cầu phù hợp nếu có." };
  } catch (error) {
    return { ok: false, message: databaseMessage(error) };
  }
}

export async function cancelResourceOffer(id: string): Promise<ResourceActionResult> {
  try {
    const { supabase, user, role } = await requireActionRole(["donor", "org", "rescue_team", "admin"]);
    let query = supabase.from("resource_offers").update({ status: "cancelled" }).eq("id", id).eq("status", "available");
    if (role !== "admin") query = query.eq("user_id", user.id);
    const { data, error } = await query.select("id").maybeSingle();
    if (error) return { ok: false, message: databaseMessage(error) };
    if (!data) return { ok: false, message: "Nguồn lực không tồn tại, đã được ghép hoặc đã hủy." };
    refreshResources();
    return { ok: true, message: "Đã hủy đăng ký nguồn lực." };
  } catch (error) {
    return { ok: false, message: databaseMessage(error) };
  }
}

export async function createResourceNeed(formData: FormData): Promise<ResourceActionResult> {
  try {
    const campaignId = text(formData, "campaignId");
    const { supabase, user, campaign } = await requireCampaignManager(campaignId);
    if (!["approved", "active"].includes(campaign.status)) {
      return { ok: false, message: "Chỉ chiến dịch đã duyệt hoặc đang hoạt động mới được đăng nhu cầu." };
    }
    const resourceType = text(formData, "resourceType");
    const name = text(formData, "name");
    const description = text(formData, "description");
    const category = text(formData, "category");
    const quantityNeeded = positiveNumber(formData, "quantityNeeded");
    const unit = text(formData, "unit");
    const province = text(formData, "province");
    const urgency = text(formData, "urgency");
    if (!RESOURCE_TYPES.includes(resourceType as (typeof RESOURCE_TYPES)[number]) || !quantityNeeded) {
      return { ok: false, message: "Loại và số lượng nhu cầu chưa hợp lệ." };
    }
    if (name.length < 2 || name.length > 180 || description.length > 2000 || !unit || unit.length > 40) {
      return { ok: false, message: "Tên, mô tả hoặc đơn vị nhu cầu chưa hợp lệ." };
    }
    if (!["normal", "urgent"].includes(urgency)) return { ok: false, message: "Mức độ ưu tiên không hợp lệ." };

    const { error } = await supabase.from("resource_needs").insert({
      campaign_id: campaignId,
      resource_type: resourceType,
      name,
      description,
      category: category || null,
      quantity_needed: quantityNeeded,
      unit,
      province: province || null,
      urgency,
      created_by: user.id,
    });
    if (error) return { ok: false, message: databaseMessage(error) };
    refreshResources(campaign.slug);
    return { ok: true, message: "Đã gửi nhu cầu để Admin xét duyệt. Nhu cầu chưa hiển thị công khai." };
  } catch (error) {
    return { ok: false, message: databaseMessage(error) };
  }
}

export async function closeResourceNeed(id: string): Promise<ResourceActionResult> {
  try {
    const { supabase, campaign } = await requireNeedManager(id);
    const { error } = await supabase.from("resource_needs").update({ status: "closed" }).eq("id", id);
    if (error) return { ok: false, message: databaseMessage(error) };
    refreshResources(campaign.slug);
    return { ok: true, message: "Đã đóng nhu cầu nguồn lực." };
  } catch (error) {
    return { ok: false, message: databaseMessage(error) };
  }
}

export async function deleteResourceNeed(id: string): Promise<ResourceActionResult> {
  try {
    const { supabase, campaign } = await requireNeedManager(id);
    const { error } = await supabase.from("resource_needs").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") return { ok: false, message: "Nhu cầu đã có người đăng ký; hãy đóng thay vì xóa để giữ lịch sử." };
      return { ok: false, message: databaseMessage(error) };
    }
    refreshResources(campaign.slug);
    return { ok: true, message: "Đã xóa nhu cầu chưa phát sinh đăng ký." };
  } catch (error) {
    return { ok: false, message: databaseMessage(error) };
  }
}

export async function claimResourceNeed(formData: FormData): Promise<ResourceActionResult> {
  try {
    const { supabase } = await requireActionRole(["donor", "org", "rescue_team", "admin"]);
    const needId = text(formData, "needId");
    const quantity = positiveNumber(formData, "quantity");
    const contactName = text(formData, "contactName");
    const contactEmail = text(formData, "contactEmail").toLowerCase();
    const contactPhone = text(formData, "contactPhone");
    const offerId = text(formData, "offerId");
    if (!needId || !quantity) return { ok: false, message: "Số lượng đăng ký chưa hợp lệ." };
    if (contactName.length < 2 || !EMAIL_PATTERN.test(contactEmail)) {
      return { ok: false, message: "Tên và email liên hệ chưa hợp lệ." };
    }
    const { error } = await supabase.rpc("claim_resource_need", {
      p_need_id: needId,
      p_quantity: quantity,
      p_contact_name: contactName,
      p_contact_email: contactEmail,
      p_contact_phone: contactPhone || null,
      p_offer_id: offerId || null,
    });
    if (error) return { ok: false, message: databaseMessage(error) };
    refreshResources();
    return { ok: true, message: "Đã gửi đăng ký đóng góp. Admin sẽ xác minh kết quả ghép; đăng ký này chưa được tính vào tiến độ." };
  } catch (error) {
    return { ok: false, message: databaseMessage(error) };
  }
}

export async function cancelResourceClaim(id: string): Promise<ResourceActionResult> {
  try {
    const { supabase, user } = await requireActionRole(["donor", "org", "rescue_team", "admin"]);
    const { data, error } = await supabase
      .from("resource_claims")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("contributor_id", user.id)
      .in("status", ["reserved", "confirmed"])
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, message: databaseMessage(error) };
    if (!data) return { ok: false, message: "Đăng ký không còn ở trạng thái có thể hủy." };
    refreshResources();
    return { ok: true, message: "Đã hủy đăng ký và trả lại số lượng cho wishlist." };
  } catch (error) {
    return { ok: false, message: databaseMessage(error) };
  }
}

export async function updateResourceOffer(id: string, formData: FormData): Promise<ResourceActionResult> {
  try {
    const { supabase, user, role } = await requireActionRole(["donor", "org", "rescue_team", "admin"]);
    const title = text(formData, "title");
    const description = text(formData, "description");
    const quantity = positiveNumber(formData, "quantity");
    const unit = text(formData, "unit");
    const province = text(formData, "province");
    const availableFrom = text(formData, "availableFrom");
    const contactName = text(formData, "contactName");
    const contactEmail = text(formData, "contactEmail").toLowerCase();
    const contactPhone = text(formData, "contactPhone");
    const estimatedValue = text(formData, "estimatedValue");
    const radius = text(formData, "radiusKm");

    if (title.length < 2 || title.length > 180 || description.length > 2000 || !quantity || !unit || unit.length > 40) {
      return { ok: false, message: "Tên, số lượng hoặc đơn vị nguồn lực chưa hợp lệ." };
    }
    if (contactName.length < 2 || contactName.length > 120 || !EMAIL_PATTERN.test(contactEmail)) {
      return { ok: false, message: "Tên và email liên hệ chưa hợp lệ." };
    }
    if (contactPhone && (contactPhone.length < 8 || contactPhone.length > 30)) {
      return { ok: false, message: "Số điện thoại liên hệ chưa hợp lệ." };
    }
    const estimatedValueVnd = estimatedValue ? Number(estimatedValue) : null;
    const radiusKm = radius ? Number(radius) : null;
    if (estimatedValueVnd !== null && (!Number.isFinite(estimatedValueVnd) || estimatedValueVnd < 0)) {
      return { ok: false, message: "Giá trị quy đổi không hợp lệ." };
    }
    if (radiusKm !== null && (!Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > 2000)) {
      return { ok: false, message: "Bán kính phục vụ phải từ 1 đến 2.000 km." };
    }

    let query = supabase.from("resource_offers").update({
      title,
      description,
      quantity,
      unit,
      estimated_value_vnd: estimatedValueVnd,
      province: province || null,
      available_from: availableFrom || null,
      radius_km: radiusKm,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone || null,
    }).eq("id", id).eq("status", "available");
    if (role !== "admin") query = query.eq("user_id", user.id);
    const { data, error } = await query.select("id").maybeSingle();
    if (error) return { ok: false, message: databaseMessage(error) };
    if (!data) return { ok: false, message: "Chỉ sửa được nguồn lực đang ở trạng thái Sẵn sàng (chưa ghép, chưa hủy)." };
    refreshResources();
    return { ok: true, message: "Đã cập nhật nguồn lực." };
  } catch (error) {
    return { ok: false, message: databaseMessage(error) };
  }
}

export async function updateResourceNeed(id: string, formData: FormData): Promise<ResourceActionResult> {
  try {
    const { supabase, campaign } = await requireNeedManager(id);
    const name = text(formData, "name");
    const description = text(formData, "description");
    const category = text(formData, "category");
    const quantityNeeded = positiveNumber(formData, "quantityNeeded");
    const unit = text(formData, "unit");
    const province = text(formData, "province");
    const urgency = text(formData, "urgency");
    if (!quantityNeeded) return { ok: false, message: "Số lượng nhu cầu chưa hợp lệ." };
    if (name.length < 2 || name.length > 180 || description.length > 2000 || !unit || unit.length > 40) {
      return { ok: false, message: "Tên, mô tả hoặc đơn vị nhu cầu chưa hợp lệ." };
    }
    if (!["normal", "urgent"].includes(urgency)) return { ok: false, message: "Mức độ ưu tiên không hợp lệ." };

    const { data, error } = await supabase.from("resource_needs").update({
      name,
      description,
      category: category || null,
      quantity_needed: quantityNeeded,
      unit,
      province: province || null,
      urgency,
    }).eq("id", id).eq("status", "open").select("id").maybeSingle();
    if (error) return { ok: false, message: databaseMessage(error) };
    if (!data) return { ok: false, message: "Nhu cầu đã đóng hoặc đã đủ nên không thể sửa." };
    refreshResources(campaign.slug);
    return { ok: true, message: "Đã cập nhật nhu cầu. Nhu cầu quay lại trạng thái chờ Admin duyệt lại trước khi hiển thị công khai." };
  } catch (error) {
    return { ok: false, message: databaseMessage(error) };
  }
}

export async function hideResourceOffer(id: string): Promise<ResourceActionResult> {
  try {
    const { supabase, user } = await requireActionRole(["donor", "org", "rescue_team", "admin"]);
    const { data, error } = await supabase.from("resource_offers")
      .update({ owner_hidden: true }).eq("id", id).eq("user_id", user.id).eq("status", "cancelled")
      .select("id").maybeSingle();
    if (error) return { ok: false, message: databaseMessage(error) };
    if (!data) return { ok: false, message: "Chỉ ẩn được nguồn lực đã hủy của bạn." };
    refreshResources();
    return { ok: true, message: "Đã ẩn khỏi danh sách của bạn. Lịch sử vẫn được lưu." };
  } catch (error) {
    return { ok: false, message: databaseMessage(error) };
  }
}

export async function hideResourceClaim(id: string): Promise<ResourceActionResult> {
  try {
    const { supabase, user } = await requireActionRole(["donor", "org", "rescue_team", "admin"]);
    const { data, error } = await supabase.from("resource_claims")
      .update({ owner_hidden: true }).eq("id", id).eq("contributor_id", user.id).eq("status", "cancelled")
      .select("id").maybeSingle();
    if (error) return { ok: false, message: databaseMessage(error) };
    if (!data) return { ok: false, message: "Chỉ ẩn được lượt đã hủy chưa qua xác minh của Admin." };
    refreshResources();
    return { ok: true, message: "Đã ẩn khỏi danh sách của bạn. Lịch sử vẫn được lưu." };
  } catch (error) {
    return { ok: false, message: databaseMessage(error) };
  }
}
