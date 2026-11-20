/**
 * Public origin of the incoming request.
 *
 * On Cloudflare Workers (OpenNext) `request.url` seen by Route Handlers can
 * carry an internal host (e.g. `localhost`), so redirects built from it send
 * users to the wrong place. The `Host` header is what the browser used and is
 * also what Cloudflare routed on, so it is safe to reuse for same-site redirects.
 */
export function publicOrigin(request: { url: string; headers: Headers }): string {
  const fallback = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return fallback.origin;

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : fallback.protocol.replace(":", "");
  return `${protocol}://${host}`;
}
