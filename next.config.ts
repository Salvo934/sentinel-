import type { NextConfig } from "next";

/**
 * Baseline security headers. A nonce-based Content-Security-Policy is listed
 * among the planned hardening steps (docs/LIMITATIONS.md).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Investigation data is per-user and per-organization: no server-side caching.
  cacheComponents: false,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Evidence uploads go through a Server Action (hash computed server-side).
      // 20 MB bucket limit + multipart overhead.
      bodySizeLimit: "21mb",
    },
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
