import { allowedRolesForPath } from "./permissions";
import type { AppRole } from "./roles";

export function isSafeInternalPath(value: string | null | undefined): value is string {
  return Boolean(value?.startsWith("/") && !value.startsWith("//"));
}

export function resolveAuthenticatedDestination(role: AppRole, requestedPath?: string | null): string {
  // Password recovery must remain reachable for every role, including Admin.
  if (requestedPath === "/reset-password") return requestedPath;
  if (role === "admin") return "/admin";

  if (isSafeInternalPath(requestedPath)) {
    const allowedRoles = allowedRolesForPath(requestedPath);
    if (!allowedRoles || allowedRoles.includes(role)) return requestedPath;
  }

  return "/account";
}
