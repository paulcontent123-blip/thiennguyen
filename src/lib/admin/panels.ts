export const ADMIN_PANELS = ["overview", "campaigns", "kyc", "personal", "payments", "donations", "corporate", "disbursement", "sos"] as const;
export type AdminPanelKey = (typeof ADMIN_PANELS)[number];

export function isAdminPanelKey(value: unknown): value is AdminPanelKey {
  return typeof value === "string" && (ADMIN_PANELS as readonly string[]).includes(value);
}
