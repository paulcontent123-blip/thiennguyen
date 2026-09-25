export const WALLET_MIN_TOPUP = 10_000;
export const WALLET_MAX_TOPUP = 10_000_000_000;

export type WalletTopupIntent = {
  id: string;
  txRef: string;
  amountVnd: number;
  bankId: string;
  accountNo: string;
  accountName: string;
  transferDescription: string;
  qrUrl: string;
};

export type WalletTopupResult =
  | { ok: true; message: string; intent: WalletTopupIntent }
  | { ok: false; message: string };

export type WalletTopupItem = {
  id: string;
  txRef: string;
  amountVnd: number;
  status: "pending" | "completed" | "rejected";
  adminNote: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type WalletLedgerItem = {
  id: string;
  entryType: "topup" | "allocation" | "reversal";
  amountVnd: number;
  campaignId: string | null;
  transactionId: string | null;
  note: string | null;
  createdAt: string;
};

export type WalletCampaign = {
  id: string;
  slug: string;
  title: string;
  ownerName: string;
};

export type WalletAllocationItem = {
  id: string;
  campaignId: string;
  transactionId: string | null;
  amountVnd: number;
  status: "completed" | "reversed";
  reversalReason: string | null;
  createdAt: string;
  campaignTitle: string;
  campaignSlug: string;
};

export type WalletAllocationResult =
  | { ok: true; message: string; balanceAfterVnd: number; txRef: string }
  | { ok: false; message: string };
