import { AdminPortal } from "@/components/admin/admin-portal";
import { isAdminPanelKey } from "@/lib/admin/panels";
import { requirePageRole } from "@/lib/auth/server";

export default async function AdminPage({ searchParams = {} }: { searchParams?: { panel?: string | string[] } }) {
  const requestedPanel = Array.isArray(searchParams.panel) ? searchParams.panel[0] : searchParams.panel;
  const initialPanel = isAdminPanelKey(requestedPanel) ? requestedPanel : undefined;
  const { supabase } = await requirePageRole(["admin"], "/admin");

  const [campaignsRes, organizationsRes, personalProfilesRes, disbursementsRes, rescueApplicationsRes, rescueTeamsRes, rescueInvitationsRes, sosReportsRes, receivingAccountsRes, transactionsRes, corporateInquiriesRes, sosCompletedRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, title, owner_type, owner_user_id, campaign_type, category, province, target_amount, status, review_note, submitted_at, reviewed_at, created_at, organizations(name), campaign_status_history(id, from_status, to_status, actor_name, actor_role, note, created_at)")
      .order("created_at", { ascending: false }),
    supabase
      .from("organizations")
      .select("id, name, legal_representative_name, license_status, license_number, license_note, license_file_path, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("personal_profiles")
      .select("user_id, legal_name, phone, verification_status, verification_document_path, verification_note, verified_at, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("disbursements")
      .select(
        "id, amount, description, status, evidence_paths, submitted_at, representative_approved_at, post_audit_status, post_audited_at, post_audit_note, campaigns(title)"
      )
      .order("representative_approved_at", { ascending: false }),
    supabase
      .from("rescue_applications")
      .select(
        "id, team_name, contact_name, contact_email, contact_phone, resource_types, province, radius_km, submitted_by, status, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("rescue_teams")
      .select("id, name, resource_types, province, radius_km, status, activated_at, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("rescue_invitations")
      .select("id, email, application_id, status, expires_at, accepted_at, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("sos_reports")
      .select("id, location_text, description, needs, contact_phone, status, photo_url, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("platform_receiving_accounts")
      .select("id, kind, currency, provider, bank_id, bank_name, account_no, account_name, swift_code, iban, qr_image_url, transfer_description_template, is_active, updated_at")
      .order("kind", { ascending: true }),
    supabase
      .from("transactions")
      .select(
        "id, tx_ref, amount_vnd, currency, status, donor_name, receipt_email, transfer_description, receiving_bank_id, receiving_account_no, receiving_account_name, failure_reason, created_at, expires_at, completed_at, campaigns(title, slug)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("corporate_inquiries")
      .select("id, company_name, contact_name, contact_email, budget_range, focus_area, interest, status, created_at, handled_at, campaigns(title)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("sos_team_alerts")
      .select("sos_report_id, sos_reports!inner(status)")
      .eq("response_status", "completed")
      .in("sos_reports.status", ["urgent", "needs_support"]),
  ]);

  const personalProfiles = await Promise.all((personalProfilesRes.data ?? []).map(async (profile) => {
    if (!profile.verification_document_path) return { ...profile, document_url: null };
    const { data } = await supabase.storage.from("personal-verification").createSignedUrl(profile.verification_document_path, 300);
    return { ...profile, document_url: data?.signedUrl ?? null };
  }));

  return (
    <AdminPortal
      initialPanel={initialPanel}
      sosAwaitingClosure={new Set((sosCompletedRes.data ?? []).map((row) => row.sos_report_id)).size}
      campaigns={campaignsRes.data ?? []}
      organizations={organizationsRes.data ?? []}
      personalProfiles={personalProfiles}
      disbursements={disbursementsRes.data ?? []}
      rescueApplications={rescueApplicationsRes.data ?? []}
      rescueTeams={rescueTeamsRes.data ?? []}
      rescueInvitations={rescueInvitationsRes.data ?? []}
      sosReports={sosReportsRes.data ?? []}
      receivingAccounts={receivingAccountsRes.data ?? []}
      transactions={transactionsRes.data ?? []}
      corporateInquiries={corporateInquiriesRes.data ?? []}
    />
  );
}
