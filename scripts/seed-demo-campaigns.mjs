import { createClient } from "@supabase/supabase-js";

if (process.env.DEMO_SEED_ENABLED !== "true") {
  throw new Error("Từ chối seed: đặt DEMO_SEED_ENABLED=true trong môi trường development/staging trước khi chạy.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL (hoặc SUPABASE_URL) và SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function slugify(input) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const { data: organization, error: organizationError } = await supabase
  .from("organizations")
  .select("id")
  .eq("legal_representative_email", "org@demo.vn")
  .maybeSingle();
if (organizationError) throw organizationError;
if (!organization) throw new Error("Chưa có Tổ chức Demo — chạy `npm run seed:demo` trước.");

const { data: adminProfile, error: adminError } = await supabase.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
if (adminError) throw adminError;
if (!adminProfile) throw new Error("Chưa có tài khoản admin — chạy `npm run seed:demo` trước.");

const demoCampaigns = [
  { title: "Học bổng vượt khó Hà Giang 2026", category: "Giáo dục", province: "Hà Giang", campaignType: "direct", targetAmount: 150_000_000 },
  { title: "Bếp ăn từ thiện Sài Gòn", category: "Lương thực", province: "TP. Hồ Chí Minh", campaignType: "direct", targetAmount: 80_000_000 },
  { title: "Khám bệnh miễn phí vùng cao Lào Cai", category: "Y tế", province: "Lào Cai", campaignType: "partner", targetAmount: 200_000_000 },
  { title: "Xây nhà tình thương Cần Thơ", category: "Nhà ở", province: "Cần Thơ", campaignType: "direct", targetAmount: 300_000_000 },
  { title: "Cứu trợ khẩn cấp bão lũ Nghệ An", category: "Cứu trợ khẩn cấp", province: "Nghệ An", campaignType: "direct", targetAmount: 500_000_000 },
  { title: "Ngày hội cộng đồng Đà Nẵng", category: "Cộng đồng", province: "Đà Nẵng", campaignType: "partner", targetAmount: 60_000_000 },
  { title: "Thư viện sách cho em Đắk Lắk", category: "Giáo dục", province: "Đắk Lắk", campaignType: "direct", targetAmount: 45_000_000 },
  { title: "Hỗ trợ y tế trẻ em Hải Phòng", category: "Y tế", province: "Hải Phòng", campaignType: "direct", targetAmount: 120_000_000 },
];

const now = new Date().toISOString();

for (const item of demoCampaigns) {
  const slug = slugify(item.title);
  const { error } = await supabase.from("campaigns").upsert(
    {
      organization_id: organization.id,
      title: item.title,
      slug,
      summary: `Chiến dịch thiện nguyện demo tại ${item.province}.`,
      description: `Đây là dữ liệu demo cho chiến dịch "${item.title}" tại ${item.province}, phục vụ kiểm thử tìm kiếm và lọc theo tỉnh/thành, hạng mục, loại chiến dịch.`,
      target_amount: item.targetAmount,
      campaign_type: item.campaignType,
      category: item.category,
      province: item.province,
      status: "active",
      reviewed_at: now,
      reviewed_by: adminProfile.id,
      published_at: now,
    },
    { onConflict: "slug" },
  );
  if (error) throw error;
}

console.log(`Đã đồng bộ ${demoCampaigns.length} chiến dịch demo cho development/staging (trải đều theo tỉnh/thành, hạng mục, loại chiến dịch).`);
