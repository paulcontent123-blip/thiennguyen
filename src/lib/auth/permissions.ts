import type { AppRole } from "./roles";

export const ROUTE_ROLES: ReadonlyArray<{ prefix: string; roles: readonly AppRole[] }> = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/organization", roles: ["org"] },
  { prefix: "/rescue/operations", roles: ["rescue_team", "admin"] },
  { prefix: "/account", roles: ["donor", "org", "rescue_team", "admin"] },
];

export function allowedRolesForPath(pathname: string): readonly AppRole[] | null {
  return ROUTE_ROLES.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.roles ?? null;
}
