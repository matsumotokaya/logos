export const PLATFORM_ROLES = [
  "platform_admin",
  "support",
  "labs_member",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const LABS_PLATFORM_ROLES: ReadonlySet<PlatformRole> = new Set([
  "platform_admin",
  "labs_member",
]);

export function canAccessLabs(roles: Iterable<PlatformRole>): boolean {
  for (const role of roles) {
    if (LABS_PLATFORM_ROLES.has(role)) return true;
  }
  return false;
}
