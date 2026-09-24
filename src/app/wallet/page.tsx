import { SiteHeader } from "@/components/site-header";
import { WalletPanel } from "@/components/wallet/wallet-panel";
import { requirePageRole } from "@/lib/auth/server";
import type { WalletLedgerItem, WalletTopupItem } from "@/lib/wallet/types";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const { supabase, user } = await requirePageRole(["donor", "org"], "/wallet");
  const [balanceResult, ledgerResult, topupResult] = await Promise.all([
    supabase.from("wallet_ledger").select("amount_vnd").eq("user_id", user.id),
    supabase.from("wallet_ledger").select("id, amount_vnd, note, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase
      .from("wallet_topups")
      .select("id, tx_ref, amount_vnd, status, admin_note, created_at, completed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const loadError = balanceResult.error || ledgerResult.error || topupResult.error
    ? "Không đọc được dữ liệu ví. Hãy áp dụng migration 202609240018_wallet_topups.sql trên database."
    : null;

  const ledger: WalletLedgerItem[] = (ledgerResult.data ?? []).map((row) => ({
    id: row.id, amountVnd: Number(row.amount_vnd), note: row.note, createdAt: row.created_at,
  }));
  const topups: WalletTopupItem[] = (topupResult.data ?? []).map((row) => ({
    id: row.id, txRef: row.tx_ref, amountVnd: Number(row.amount_vnd), status: row.status as WalletTopupItem["status"],
    adminNote: row.admin_note, createdAt: row.created_at, completedAt: row.completed_at,
  }));
  const balance = (balanceResult.data ?? []).reduce((sum, row) => sum + Number(row.amount_vnd), 0);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <WalletPanel balance={balance} ledger={ledger} topups={topups} loadError={loadError} />
    </main>
  );
}
