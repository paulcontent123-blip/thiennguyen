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
  amountVnd: number;
  note: string | null;
  createdAt: string;
};
