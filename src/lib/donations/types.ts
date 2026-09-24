export type DonationIntent = {
  id: string;
  txRef: string;
  amountVnd: number;
  status: "pending";
  bankId: string;
  accountNo: string;
  accountName: string;
  transferDescription: string;
  qrUrl: string;
  expiresAt: string;
  createdAt: string;
};

export type DonationActionResult =
  | { ok: true; message: string; intent: DonationIntent }
  | { ok: false; message: string };

export type DonationReceipt = {
  donorName: string | null;
  receiptEmail: string;
  campaignTypeLabel: string;
  ownerName: string | null;
  bankId: string;
  accountNoMasked: string;
  accountName: string;
  transferDescription: string;
  receivedAmountVnd: number;
};

export type DonationHistoryItem = {
  id: string;
  txRef: string;
  amountVnd: number;
  status: string;
  campaignTitle: string;
  campaignSlug: string;
  createdAt: string;
  completedAt: string | null;
  receipt: DonationReceipt | null;
};

export const DONATION_MIN_AMOUNT = 10_000;
export const DONATION_MAX_AMOUNT = 10_000_000_000;
