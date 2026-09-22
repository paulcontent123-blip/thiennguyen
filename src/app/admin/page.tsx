import { AdminPortal } from "@/components/admin/admin-portal";
import { requirePageRole } from "@/lib/auth/server";

export default async function AdminPage() {
  const { supabase } = await requirePageRole(["admin"], "/admin");

  const [campaignsRes, organizationsRes, disbursementsRes, rescueApplicationsRes, sosReportsRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, title, campaign_type, target_amount, status, review_note, submitted_at, reviewed_at, created_at, organizations(name), campaign_status_history(id, from_status, to_status, actor_name, actor_role, note, created_at)")
      .order("created_at", { ascending: false }),
    supabase
      .from("organizations")
      .select("id, name, legal_representative_name, license_status, license_number, license_note, license_file_path, created_at")
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
      .from("sos_reports")
      .select("id, location_text, needs, contact_phone, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AdminPortal
      campaigns={campaignsRes.data ?? []}
      organizations={organizationsRes.data ?? []}
      disbursements={disbursementsRes.data ?? []}
      rescueApplications={rescueApplicationsRes.data ?? []}
      sosReports={sosReportsRes.data ?? []}
    />
  );
}
