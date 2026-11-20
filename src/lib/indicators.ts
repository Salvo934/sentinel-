/**
 * Indicator of Compromise helpers: format validation, type detection,
 * normalisation and defanging. Pure functions (unit-tested).
 */
import type { IocType } from "@/lib/domain";

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HEX = (n: number) => new RegExp(`^[a-f0-9]{${n}}$`, "i");
// LDH labels, 1–63 chars, no leading/trailing hyphen, at least one dot, alphabetic (or xn--) TLD.
const DOMAIN = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;

export function isIPv4(value: string): boolean {
  return IPV4.test(value);
}

export function isIPv6(value: string): boolean {
  if (!value.includes(":") || value.length > 45) return false;
  // Accept an embedded IPv4 tail (::ffff:192.0.2.1).
  let v = value.toLowerCase();
  const lastColon = v.lastIndexOf(":");
  const tail = v.slice(lastColon + 1);
  let extraGroups = 0;
  if (tail.includes(".")) {
    if (!isIPv4(tail)) return false;
    v = v.slice(0, lastColon + 1) + "0:0";
    extraGroups = 0;
  }
  const doubleColon = v.split("::");
  if (doubleColon.length > 2) return false;
  const groups = (s: string) => (s === "" ? [] : s.split(":"));
  const head = groups(doubleColon[0] ?? "");
  const rest = doubleColon.length === 2 ? groups(doubleColon[1] ?? "") : [];
  const all = [...head, ...rest];
  if (!all.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return false;
  const count = all.length + extraGroups;
  return doubleColon.length === 2 ? count < 8 : count === 8;
}

export function isDomain(value: string): boolean {
  return DOMAIN.test(value);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Reverses common defanging: hxxp → http, [.] / (.) / {.} → ., [:] → : */
export function refang(value: string): string {
  return value
    .trim()
    .replace(/^hxxp(s?):\/\//i, "http$1://")
    .replace(/\[\.\]|\(\.\)|\{\.\}|\[dot\]/gi, ".")
    .replace(/\[:\]/g, ":");
}

/** Makes an indicator non-clickable for display and reports. */
export function defang(value: string): string {
  return value
    .replace(/^http(s?):\/\//i, "hxxp$1://")
    .replace(/\.(?=[^.]*$)/, "[.]");
}

export function normalizeIndicator(type: IocType, raw: string): string {
  const v = refang(raw);
  switch (type) {
    case "domain":
      return v.toLowerCase().replace(/\.$/, "");
    case "sha256":
    case "sha1":
    case "md5":
    case "ipv6":
      return v.toLowerCase();
    default:
      return v;
  }
}

export function validateIndicator(type: IocType, raw: string): boolean {
  const v = normalizeIndicator(type, raw);
  switch (type) {
    case "ipv4":
      return isIPv4(v);
    case "ipv6":
      return isIPv6(v);
    case "domain":
      return isDomain(v);
    case "url":
      return isHttpUrl(v);
    case "sha256":
      return HEX(64).test(v);
    case "sha1":
      return HEX(40).test(v);
    case "md5":
      return HEX(32).test(v);
  }
}

/** Best-effort type detection for a pasted value (null when unknown). */
export function detectIndicatorType(raw: string): IocType | null {
  const v = refang(raw);
  if (isIPv4(v)) return "ipv4";
  if (isIPv6(v)) return "ipv6";
  if (/^https?:\/\//i.test(v) && isHttpUrl(v)) return "url";
  if (HEX(64).test(v)) return "sha256";
  if (HEX(40).test(v)) return "sha1";
  if (HEX(32).test(v)) return "md5";
  if (isDomain(v.toLowerCase())) return "domain";
  return null;
}

/** Reserved for documentation/testing (RFC 2606, 6761, 5737, 3849). */
export function isDocumentationIndicator(type: IocType, value: string): boolean {
  const v = value.toLowerCase();
  if (type === "domain" || type === "url") {
    let host = v;
    if (type === "url") {
      try {
        host = new URL(v).hostname;
      } catch {
        return false;
      }
    }
    return /(^|\.)(example\.(com|net|org)|example|test|invalid|localhost)$/.test(host);
  }
  if (type === "ipv4") return /^(192\.0\.2|198\.51\.100|203\.0\.113)\./.test(v);
  if (type === "ipv6") return v.startsWith("2001:db8:") || v.startsWith("2001:0db8:");
  return false;
}
