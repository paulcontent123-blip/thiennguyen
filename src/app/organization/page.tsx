import { OrganizationDashboard } from "@/components/organization/organization-dashboard";
import { SiteHeader } from "@/components/site-header";
import { requirePageRole } from "@/lib/auth/server";
import { redirect } from "next/navigation";

const PAGE_SIZE = 8;

export default async function OrganizationPage({ searchParams }: { searchParams?: { page?: string } }) {
  const { supabase, user } = await requirePageRole(["org"], "/organization");
  const requestedPage = Number.parseInt(searchParams?.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, avatar_url, legal_representative_name, legal_representative_email, legal_representative_phone, license_status, license_file_path, license_number, license_note, verified_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (organizationError || !organization) throw new Error("Không tìm thấy hồ sơ tổ chức gắn với tài khoản này.");

  const from = (page - 1) * PAGE_SIZE;
  const { data: campaigns, count } = await supabase
    .from("campaigns")
    .select("id, title, summary, description, campaign_type, category, province, target_amount, deadline, status, review_note, submitted_at, created_at", { count: "exact" })
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > totalPages) redirect(`/organization?page=${totalPages}`);
  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);
  const { data: history } = campaignIds.length
    ? await supabase
        .from("campaign_status_history")
        .select("id, campaign_id, from_status, to_status, actor_name, actor_role, note, created_at")
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <OrganizationDashboard organization={organization} campaigns={campaigns ?? []} history={history ?? []} page={Math.min(page, totalPages)} total={total} totalPages={totalPages} />
    </main>
  );
}
