export const APP_ROLES = ["donor", "org", "rescue_team", "admin"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const PUBLIC_REGISTRATION_ROLES = ["donor", "org"] as const;
export type PublicRegistrationRole = (typeof PUBLIC_REGISTRATION_ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export function isPublicRegistrationRole(value: unknown): value is PublicRegistrationRole {
  return typeof value === "string" && PUBLIC_REGISTRATION_ROLES.includes(value as PublicRegistrationRole);
}
