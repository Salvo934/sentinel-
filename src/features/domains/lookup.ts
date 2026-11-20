import "server-only";

import { lookup, Resolver } from "node:dns/promises";

import { isAllowedOutboundUrl, isBlockedAddress } from "@/lib/net/ssrf";

import { computeAnomalies, EMPTY_DNS, isReservedDomain, simulatedReport, type DnsRecords, type DomainReport, type RdapSummary } from "./model";

const DNS_TIMEOUT_MS = 3000;
const RDAP_TIMEOUT_MS = 6000;
const RDAP_MAX_BYTES = 512 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;

// Small per-instance cache: avoids repeated queries (and costs) for the same domain.
const cache = new Map<string, { at: number; report: DomainReport }>();

export function getCachedReport(domain: string): DomainReport | null {
  const hit = cache.get(domain);
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return null;
  return hit.report;
}

async function resolveAll(domain: string): Promise<{ dns: DnsRecords; errors: string[] }> {
  const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 2 });
  const errors: string[] = [];
  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "ENODATA" && code !== "ENOTFOUND") errors.push(`${label}: ${code ?? "errore"}`);
      if (code === "ENOTFOUND" && label === "A") errors.push("Il dominio non esiste (NXDOMAIN).");
      return fallback;
    }
  };
  const [A, AAAA, MX, NS, TXT, DMARC] = await Promise.all([
    safe("A", () => resolver.resolve4(domain), [] as string[]),
    safe("AAAA", () => resolver.resolve6(domain), [] as string[]),
    safe("MX", async () => (await resolver.resolveMx(domain)).sort((a, b) => a.priority - b.priority).map((m) => `${m.priority} ${m.exchange}`), [] as string[]),
    safe("NS", () => resolver.resolveNs(domain), [] as string[]),
    safe("TXT", async () => (await resolver.resolveTxt(domain)).map((chunks) => chunks.join("")), [] as string[]),
    safe("DMARC", async () => (await resolver.resolveTxt(`_dmarc.${domain}`)).map((chunks) => chunks.join("")), [] as string[]),
  ]);
  return { dns: { A, AAAA, MX, NS, TXT: TXT.slice(0, 30), DMARC }, errors };
}

/** HTTPS GET with redirect validation, timeout and size limit (SSRF-safe). */
async function safeFetchJson(startUrl: string): Promise<{ json: unknown; finalUrl: string }> {
  let url = startUrl;
  for (let hop = 0; hop < 4; hop++) {
    const parsed = new URL(url);
    const allowed =
      isAllowedOutboundUrl(url) ||
      (parsed.protocol === "https:" && /^rdap\.[a-z0-9.-]+$/i.test(parsed.hostname) && parsed.port === "" && !parsed.username);
    if (!allowed) throw new Error(`destinazione non consentita (${parsed.hostname})`);
    const addresses = await lookup(parsed.hostname, { all: true });
    if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) {
      throw new Error("la destinazione risolve su un indirizzo non pubblico");
    }

    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
      headers: { accept: "application/rdap+json, application/json", "user-agent": "SentinelIntelligence/0.1 (RDAP client)" },
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("redirect senza destinazione");
      url = new URL(location, url).toString();
      continue;
    }
    if (res.status === 404) throw new Error("dominio non presente nel registro RDAP");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > RDAP_MAX_BYTES) throw new Error("risposta troppo grande");
    const text = await res.text();
    if (text.length > RDAP_MAX_BYTES) throw new Error("risposta troppo grande");
    return { json: JSON.parse(text), finalUrl: url };
  }
  throw new Error("troppi redirect");
}

type RdapEntity = { roles?: string[]; vcardArray?: [string, [string, unknown, string, string][]] };
type RdapJson = {
  events?: { eventAction?: string; eventDate?: string }[];
  status?: string[];
  nameservers?: { ldhName?: string }[];
  entities?: RdapEntity[];
};

export function summarizeRdap(json: RdapJson, source: string): RdapSummary {
  const event = (action: string) => json.events?.find((e) => e.eventAction === action)?.eventDate ?? null;
  const registrarEntity = json.entities?.find((e) => e.roles?.includes("registrar"));
  const fn = registrarEntity?.vcardArray?.[1]?.find((v) => v[0] === "fn")?.[3] ?? null;
  return {
    registrar: typeof fn === "string" ? fn : null,
    registration: event("registration"),
    expiration: event("expiration"),
    lastChanged: event("last changed"),
    status: (json.status ?? []).slice(0, 20),
    nameservers: (json.nameservers ?? []).map((n) => (n.ldhName ?? "").toLowerCase()).filter(Boolean).slice(0, 20),
    source,
  };
}

/**
 * Passive collection only: DNS resolution and the registry's RDAP service.
 * The target's own web server is never contacted (no HTTP, no crawling, no scans).
 */
export async function collectDomainReport(domain: string): Promise<{ report: DomainReport; cached: boolean }> {
  const cached = getCachedReport(domain);
  if (cached) return { report: cached, cached: true };

  if (isReservedDomain(domain)) {
    const report = simulatedReport(domain);
    return { report, cached: false };
  }

  const [{ dns, errors }, rdapResult] = await Promise.all([
    resolveAll(domain).catch(() => ({ dns: EMPTY_DNS, errors: ["Risoluzione DNS non riuscita"] })),
    safeFetchJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`)
      .then(({ json, finalUrl }) => ({ rdap: summarizeRdap(json as RdapJson, new URL(finalUrl).hostname), error: null }))
      .catch((e: Error) => ({ rdap: null, error: `RDAP non disponibile: ${e.message}` })),
  ]);

  const report: DomainReport = {
    domain,
    dataMode: "live",
    collectedAt: new Date().toISOString(),
    dns,
    dnsErrors: errors,
    rdap: rdapResult.rdap,
    rdapError: rdapResult.error,
    anomalies: computeAnomalies(dns, rdapResult.rdap),
    limitations: [
      "Fotografia al momento della raccolta: i record DNS possono cambiare rapidamente.",
      "I dati del registrante sono spesso oscurati (GDPR): l'assenza non è di per sé indicativa.",
      "Analisi del certificato TLS e reputazione da fonti esterne: pianificate per la Fase 2.",
    ],
  };
  cache.set(domain, { at: Date.now(), report });
  return { report, cached: false };
}
