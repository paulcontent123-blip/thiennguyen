import { SiteHeader } from "@/components/site-header";
import { WalletPanel } from "@/components/wallet/wallet-panel";
import { requirePageRole } from "@/lib/auth/server";
import type { WalletAllocationItem, WalletCampaign, WalletLedgerItem, WalletTopupItem } from "@/lib/wallet/types";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const { supabase, user } = await requirePageRole(["donor", "org"], "/wallet");
  const [balanceResult, ledgerResult, topupResult, allocationResult, campaignsResult] = await Promise.all([
    supabase.from("wallet_accounts").select("available_balance_vnd").eq("user_id", user.id).maybeSingle(),
    supabase.from("wallet_ledger").select("id, entry_type, amount_vnd, campaign_id, transaction_id, note, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase
      .from("wallet_topups")
      .select("id, tx_ref, amount_vnd, status, admin_note, created_at, completed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("wallet_allocations")
      .select("id, campaign_id, transaction_id, amount_vnd, status, reversal_reason, created_at, campaigns(title, slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("campaigns")
      .select("id, slug, title, owner_type, organizations(name)")
      .eq("status", "active")
      .order("published_at", { ascending: false })
      .limit(200),
  ]);
  const loadError = balanceResult.error || ledgerResult.error || topupResult.error || allocationResult.error || campaignsResult.error
    ? "Không đọc được đầy đủ dữ liệu ví. Hãy áp dụng migration 202609250002_wallet_disbursement_receipts.sql trên database."
    : null;

  const ledger: WalletLedgerItem[] = (ledgerResult.data ?? []).map((row) => ({
    id: row.id, entryType: row.entry_type as WalletLedgerItem["entryType"], amountVnd: Number(row.amount_vnd),
    campaignId: row.campaign_id, transactionId: row.transaction_id, note: row.note, createdAt: row.created_at,
  }));
  const topups: WalletTopupItem[] = (topupResult.data ?? []).map((row) => ({
    id: row.id, txRef: row.tx_ref, amountVnd: Number(row.amount_vnd), status: row.status as WalletTopupItem["status"],
    adminNote: row.admin_note, createdAt: row.created_at, completedAt: row.completed_at,
  }));
  const allocations: WalletAllocationItem[] = (allocationResult.data ?? []).map((row) => {
    const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns;
    return {
      id: row.id, campaignId: row.campaign_id, transactionId: row.transaction_id,
      amountVnd: Number(row.amount_vnd), status: row.status as WalletAllocationItem["status"],
      reversalReason: row.reversal_reason, createdAt: row.created_at,
      campaignTitle: campaign?.title ?? "Chiến dịch", campaignSlug: campaign?.slug ?? "",
    };
  });
  const campaigns: WalletCampaign[] = (campaignsResult.data ?? []).map((row) => {
    const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    return { id: row.id, slug: row.slug, title: row.title, ownerName: row.owner_type === "individual" ? "Chủ chiến dịch cá nhân" : organization?.name ?? "Tổ chức thiện nguyện" };
  });
  const balance = Number(balanceResult.data?.available_balance_vnd ?? 0);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <WalletPanel balance={balance} ledger={ledger} topups={topups} allocations={allocations} campaigns={campaigns} loadError={loadError} />
    </main>
  );
}
