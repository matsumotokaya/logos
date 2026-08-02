export const URL_REGISTRATION_SCOPES = [
  "organization",
  "business",
  "both",
] as const;

export type UrlRegistrationScope =
  (typeof URL_REGISTRATION_SCOPES)[number];

export function isUrlRegistrationScope(
  value: unknown,
): value is UrlRegistrationScope {
  return URL_REGISTRATION_SCOPES.includes(value as UrlRegistrationScope);
}
