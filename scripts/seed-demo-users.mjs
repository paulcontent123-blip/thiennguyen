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

const demoUsers = [
  { email: "admin@demo.vn", password: "123456", fullName: "Admin Demo", role: "admin", accountType: "donor" },
  { email: "donor@demo.vn", password: "123456", fullName: "Donor Demo", role: "donor", accountType: "donor" },
  { email: "org@demo.vn", password: "123456", fullName: "Organization Demo", role: "org", accountType: "org" },
  { email: "rescue_team@demo.vn", password: "123456", fullName: "Rescue Team Demo", role: "rescue_team", accountType: "donor" },
];

async function findUserByEmail(email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 200) return null;
  }
}

async function ensureAuthUser(item) {
  const existing = await findUserByEmail(item.email);
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: item.password,
      email_confirm: true,
      user_metadata: { full_name: item.fullName, account_type: item.accountType },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: item.email,
    password: item.password,
    email_confirm: true,
    user_metadata: { full_name: item.fullName, account_type: item.accountType },
  });
  if (error) throw error;
  return data.user;
}

const users = new Map();
for (const item of demoUsers) {
  const user = await ensureAuthUser(item);
  users.set(item.role, user);

  const { error } = await supabase.from("profiles").upsert(
    { id: user.id, role: item.role, full_name: item.fullName },
    { onConflict: "id" },
  );
  if (error) throw error;
}

const orgUser = users.get("org");
const adminUser = users.get("admin");
const rescueUser = users.get("rescue_team");

const { error: organizationError } = await supabase.from("organizations").upsert(
  {
    user_id: orgUser.id,
    name: "Tổ chức Demo",
    legal_representative_name: "Organization Demo",
    legal_representative_email: "org@demo.vn",
  },
  { onConflict: "user_id" },
);
if (organizationError) throw organizationError;

const { data: existingRescueTeam, error: rescueTeamReadError } = await supabase
  .from("rescue_teams")
  .select("id")
  .eq("user_id", rescueUser.id)
  .maybeSingle();
if (rescueTeamReadError) throw rescueTeamReadError;

if (!existingRescueTeam) {
  const { error: rescueTeamError } = await supabase.from("rescue_teams").insert({
    user_id: rescueUser.id,
    name: "Đội cứu trợ Demo",
    resource_types: ["medical", "rescue"],
    province: "Hà Nội",
    radius_km: 20,
    status: "available",
    activated_by: adminUser.id,
  });
  if (rescueTeamError) throw rescueTeamError;
}

console.log("Đã đồng bộ 4 tài khoản demo cho development/staging:");
for (const item of demoUsers) console.log(`- ${item.email} (${item.role})`);
