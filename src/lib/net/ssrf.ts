/**
 * SSRF protections for every outbound request made by the backend.
 *
 * Sentinel never fetches arbitrary user-supplied URLs. Outbound HTTP goes
 * only to an allow-list of well-known public data providers (RDAP, threat
 * intel APIs) and every resolved address is checked against private,
 * loopback, link-local, multicast and reserved ranges before connecting.
 */

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export function isBlockedIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToInt(base) & mask);
  });
}

export function isBlockedIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isBlockedIPv4(mapped[1]);
  return (
    /^f[cd]/.test(v) || // unique local fc00::/7
    /^fe[89ab]/.test(v) || // link-local fe80::/10
    /^ff/.test(v) || // multicast
    v.startsWith("2001:db8") || // documentation
    v.startsWith("64:ff9b:") || // NAT64
    v.startsWith("100::") // discard
  );
}

export function isBlockedAddress(ip: string): boolean {
  return ip.includes(":") ? isBlockedIPv6(ip) : isBlockedIPv4(ip);
}

/** Outbound hosts the backend may contact over HTTPS. */
export const ALLOWED_OUTBOUND_HOSTS = new Set([
  "rdap.org",
  "data.iana.org",
  // RDAP servers commonly referenced by the IANA bootstrap file.
  "rdap.verisign.com",
  "rdap.publicinterestregistry.org",
  "rdap.nic.it",
  "rdap.identitydigital.services",
  "rdap.centralnic.com",
  "rdap.nominet.uk",
  "rdap.donuts.co",
  "pubapi.registry.google",
  "rdap.arin.net",
  "rdap.db.ripe.net",
  "rdap.apnic.net",
  "rdap.lacnic.net",
  "rdap.afrinic.net",
  // Optional threat-intel providers (Phase 2).
  "www.virustotal.com",
  "otx.alienvault.com",
  "services.nvd.nist.gov",
]);

export function isAllowedOutboundUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      (url.port === "" || url.port === "443") &&
      ALLOWED_OUTBOUND_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}
