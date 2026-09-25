import { AdminPortal } from "@/components/admin/admin-portal";
import type { AdminResourceClaim, AdminResourceNeed, AdminResourceOffer } from "@/components/admin/admin-resource-workflow";
import { isAdminPanelKey } from "@/lib/admin/panels";
import { requirePageRole } from "@/lib/auth/server";
import type { NewsMediaAsset, NewsPost } from "@/lib/news/types";

export default async function AdminPage({ searchParams = {} }: { searchParams?: { panel?: string | string[] } }) {
  const requestedPanel = Array.isArray(searchParams.panel) ? searchParams.panel[0] : searchParams.panel;
  const initialPanel = isAdminPanelKey(requestedPanel) ? requestedPanel : undefined;
  const { supabase } = await requirePageRole(["admin"], "/admin");

  const [campaignsRes, organizationsRes, personalProfilesRes, disbursementsRes, rescueApplicationsRes, rescueTeamsRes, rescueInvitationsRes, sosReportsRes, receivingAccountsRes, transactionsRes, corporateInquiriesRes, sosCompletedRes, resourceNeedsRes, resourceOffersRes, resourceClaimsRes, walletTopupsRes, walletAllocationsRes, newsPostsRes, newsMediaRes] = await Promise.all([
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
        "id, amount, description, status, evidence_paths, submitted_at, representative_approved_at, post_audit_status, post_audited_at, post_audit_note, explanation, explanation_submitted_at, published_at, campaigns(title)"
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
        "id, tx_ref, amount_vnd, currency, status, donor_name, receipt_email, transfer_description, receiving_bank_id, receiving_account_no, receiving_account_name, failure_reason, created_at, expires_at, completed_at, receipt_pdf_hash, receipt_email_status, receipt_email_attempts, receipt_email_last_error, campaigns(title, slug)"
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
    supabase
      .from("resource_needs")
      .select("id, campaign_id, resource_type, name, description, quantity_needed, unit, province, urgency, status, moderation_status, review_note, created_at, campaigns(title, slug, province)")
      .order("created_at", { ascending: false }),
    supabase
      .from("resource_offers")
      .select("id, user_id, resource_type, title, description, quantity, unit, province, available_from, contact_name, contact_email, contact_phone, preferred_campaign_id, status, created_at")
      .eq("status", "available")
      .order("created_at", { ascending: false }),
    supabase
      .from("resource_claims")
      .select("id, need_id, contributor_id, quantity, delivered_quantity, contact_name, contact_email, contact_phone, status, coordination_note, actual_value_vnd, created_at, resource_needs(name, unit, campaigns(title, slug))")
      .order("created_at", { ascending: false }),
    supabase
      .from("wallet_topups")
      .select("id, user_id, tx_ref, amount_vnd, status, transfer_description, receiving_account_name, receiving_account_no, admin_note, created_at, completed_at, profiles!wallet_topups_user_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("wallet_allocations")
      .select("id, user_id, amount_vnd, status, reversal_reason, created_at, profiles!wallet_allocations_user_id_fkey(full_name), campaigns(title), transactions!wallet_allocations_transaction_id_fkey(tx_ref)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("news_posts")
      .select("id, slug, title, excerpt, content, category, tags, cover_url, status, author_id, published_at, created_at, updated_at, meta_title, meta_description, focus_keyword, canonical_url")
      .order("created_at", { ascending: false }),
    supabase
      .from("news_media")
      .select("id, url, public_id, original_name, alt_text, width, height, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const relation = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;
  const resourceNeeds: AdminResourceNeed[] = (resourceNeedsRes.data ?? []).map((row) => {
    const campaign = relation(row.campaigns as { title: string; slug: string; province: string | null } | { title: string; slug: string; province: string | null }[] | null);
    return {
      id: row.id, campaign_id: row.campaign_id, resource_type: row.resource_type as AdminResourceNeed["resource_type"],
      name: row.name, description: row.description ?? "", quantity_needed: Number(row.quantity_needed), unit: row.unit,
      province: row.province, urgency: row.urgency, status: row.status, moderation_status: row.moderation_status,
      review_note: row.review_note, created_at: row.created_at, campaign_title: campaign?.title ?? "Chiến dịch",
      campaign_slug: campaign?.slug ?? "", campaign_province: campaign?.province ?? null,
    };
  });
  const resourceOffers: AdminResourceOffer[] = (resourceOffersRes.data ?? []).map((row) => ({
    id: row.id, user_id: row.user_id, resource_type: row.resource_type as AdminResourceOffer["resource_type"],
    title: row.title, description: row.description ?? "", quantity: Number(row.quantity), unit: row.unit,
    province: row.province, available_from: row.available_from, contact_name: row.contact_name,
    contact_email: row.contact_email, contact_phone: row.contact_phone, preferred_campaign_id: row.preferred_campaign_id, created_at: row.created_at,
  }));
  const resourceClaims: AdminResourceClaim[] = (resourceClaimsRes.data ?? []).map((row) => {
    const need = relation(row.resource_needs as unknown as { name: string; unit: string; campaigns: { title: string; slug: string } | { title: string; slug: string }[] | null } | { name: string; unit: string; campaigns: { title: string; slug: string } | { title: string; slug: string }[] | null }[] | null);
    const campaign = relation(need?.campaigns);
    return {
      id: row.id, need_id: row.need_id, contributor_id: row.contributor_id, quantity: Number(row.quantity),
      delivered_quantity: row.delivered_quantity === null ? null : Number(row.delivered_quantity),
      contact_name: row.contact_name, contact_email: row.contact_email, contact_phone: row.contact_phone,
      status: row.status, coordination_note: row.coordination_note, actual_value_vnd: row.actual_value_vnd === null ? null : Number(row.actual_value_vnd),
      created_at: row.created_at, need_name: need?.name ?? "Nhu cầu nguồn lực", need_unit: need?.unit ?? "đơn vị",
      campaign_title: campaign?.title ?? "Chiến dịch", campaign_slug: campaign?.slug ?? "",
    };
  });
  const resourceLoadError = resourceNeedsRes.error || resourceOffersRes.error || resourceClaimsRes.error
    ? "Không đọc được dữ liệu nguồn lực. Hãy áp dụng migration 202609240010_resource_admin_workflow.sql trên database."
    : null;

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
      walletTopups={walletTopupsRes.data ?? []}
      walletAllocations={walletAllocationsRes.data ?? []}
      resourceNeeds={resourceNeeds}
      resourceOffers={resourceOffers}
      resourceClaims={resourceClaims}
      resourceLoadError={resourceLoadError}
      newsPosts={newsPostsRes.data ?? []}
      newsMedia={(newsMediaRes.data ?? []) as NewsMediaAsset[]}
      newsEditorLoadError={newsPostsRes.error || newsMediaRes.error ? "Chưa đọc được thư viện tin tức. Hãy áp dụng migration 202609250005_news_editor_media_seo.sql." : null}
    />
  );
}
