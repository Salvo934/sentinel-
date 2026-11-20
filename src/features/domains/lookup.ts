import "server-only";

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

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const RR_TYPE: Record<string, number> = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28 };

type DohAnswer = { name: string; type: number; data: string };

/**
 * DNS over HTTPS (Cloudflare 1.1.1.1 JSON API). Works identically on Node.js
 * and on Cloudflare Workers, where node:dns resolvers are not available.
 * Only the resolver is contacted, never the domain's own infrastructure.
 */
export async function dohQuery(name: string, type: keyof typeof RR_TYPE): Promise<{ status: number; answers: string[] }> {
  const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(DNS_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw Object.assign(new Error(`DoH HTTP ${res.status}`), { code: "EDOH" });
  const json = (await res.json()) as { Status: number; Answer?: DohAnswer[] };
  const answers = (json.Answer ?? []).filter((a) => a.type === RR_TYPE[type]).map((a) => a.data);
  return { status: json.Status, answers };
}

const unquoteTxt = (txt: string) => txt.replace(/^"|"$/g, "").replace(/"\s+"/g, "");
const stripDot = (v: string) => v.replace(/\.$/, "");

async function resolveAll(domain: string): Promise<{ dns: DnsRecords; errors: string[] }> {
  const errors: string[] = [];
  const safe = async (label: string, name: string, type: keyof typeof RR_TYPE): Promise<string[]> => {
    try {
      const { status, answers } = await dohQuery(name, type);
      if (status === 3 && label === "A") errors.push("Il dominio non esiste (NXDOMAIN).");
      else if (status !== 0 && status !== 3) errors.push(`${label}: errore DNS (rcode ${status})`);
      return answers;
    } catch {
      errors.push(`${label}: risoluzione non riuscita`);
      return [];
    }
  };
  const [A, AAAA, MX, NS, TXT, DMARC] = await Promise.all([
    safe("A", domain, "A"),
    safe("AAAA", domain, "AAAA"),
    safe("MX", domain, "MX"),
    safe("NS", domain, "NS"),
    safe("TXT", domain, "TXT"),
    safe("DMARC", `_dmarc.${domain}`, "TXT"),
  ]);
  const mx = MX.map((m) => {
    const [prio, host] = m.split(/\s+/);
    return { prio: Number(prio), text: `${prio} ${stripDot(host ?? "")}` };
  })
    .sort((a, b) => a.prio - b.prio)
    .map((m) => m.text);
  return {
    dns: {
      A,
      AAAA,
      MX: mx,
      NS: NS.map(stripDot),
      TXT: TXT.map(unquoteTxt).slice(0, 30),
      DMARC: DMARC.map(unquoteTxt),
    },
    errors,
  };
}

/** Public addresses of a host, resolved over DoH (used by the SSRF guard). */
async function resolveHostAddresses(host: string): Promise<string[]> {
  const [a, aaaa] = await Promise.all([dohQuery(host, "A"), dohQuery(host, "AAAA")]);
  return [...a.answers, ...aaaa.answers];
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
    const addresses = await resolveHostAddresses(parsed.hostname);
    if (!addresses.length || addresses.some((a) => isBlockedAddress(a))) {
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
