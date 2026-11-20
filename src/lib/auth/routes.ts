/**
 * Route classification and redirect helpers.
 * Pure functions (no Next.js / Supabase imports) so they can be unit-tested
 * and used from proxy.ts, Server Components and Client Components.
 */

export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";
export const LOGIN_PATH = "/login";

/** Areas that require an authenticated session. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/investigations",
  "/osint",
  "/threat-intel",
  "/attack",
  "/domains",
  "/phishing",
  "/graph",
  "/risk",
  "/evidence",
  "/reports",
  "/training",
  "/missions",
  "/assistant",
  "/settings",
  "/update-password",
] as const;

/** Pages that make no sense for a signed-in user (they get sent to the app). */
const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY_PATHS.some((path) => matchesPrefix(pathname, path));
}

const PLACEHOLDER_ORIGIN = "http://sentinel.invalid";

/**
 * Returns a same-origin relative path, or `fallback` if `value` could send the
 * user to another site (open-redirect protection).
 *
 * Rejects absolute URLs, protocol-relative URLs (`//evil.com`), backslash
 * tricks (`/\evil.com`), control characters and non-string input.
 */
export function safeRedirectPath(value: unknown, fallback: string = DEFAULT_AUTHENTICATED_PATH): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return fallback;
  }
  // Must be a root-relative path, and not "//" or "/\" (both resolve cross-origin).
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return fallback;
  }

  try {
    const url = new URL(value, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
