/**
 * Domain analysis data model and anomaly heuristics (pure, unit-tested).
 * The heuristics describe observations; the risk level is set by the analyst.
 */

export type DnsRecords = {
  A: string[];
  AAAA: string[];
  MX: string[];
  NS: string[];
  TXT: string[];
  DMARC: string[];
};

export type RdapSummary = {
  registrar: string | null;
  registration: string | null;
  expiration: string | null;
  lastChanged: string | null;
  status: string[];
  nameservers: string[];
  source: string;
};

export type DomainReport = {
  domain: string;
  dataMode: "live" | "simulated";
  collectedAt: string;
  dns: DnsRecords;
  dnsErrors: string[];
  rdap: RdapSummary | null;
  rdapError: string | null;
  anomalies: string[];
  limitations: string[];
};

export const EMPTY_DNS: DnsRecords = { A: [], AAAA: [], MX: [], NS: [], TXT: [], DMARC: [] };

const PARKING_NS = /(parking|parked|sedo|bodis|above\.com|dan\.com|afternic|hostveloce)/i;

export function isReservedDomain(domain: string): boolean {
  return /(^|\.)(example\.(com|net|org)|example|test|invalid|localhost)$/.test(domain);
}

export function computeAnomalies(dns: DnsRecords, rdap: RdapSummary | null, now: Date = new Date()): string[] {
  const out: string[] = [];
  const spf = dns.TXT.find((t) => /^"?v=spf1/i.test(t));
  const dmarc = dns.DMARC.find((t) => /^"?v=DMARC1/i.test(t));

  if (dns.A.length === 0 && dns.AAAA.length === 0) out.push("Nessun record A/AAAA: il dominio non punta a un host web.");
  if (dns.MX.length === 0) out.push("Nessun record MX: il dominio non è configurato per ricevere posta.");
  if (!spf) out.push("Record SPF assente: chiunque può tentare di inviare posta a nome del dominio.");
  else if (/[+?]all/i.test(spf)) out.push(`SPF permissivo (${spf.match(/[+?]all/i)![0]}): non protegge dallo spoofing.`);
  if (!dmarc) out.push("Record DMARC assente.");
  else if (/p=none/i.test(dmarc)) out.push("DMARC in modalità monitoraggio (p=none): nessuna azione sui messaggi non conformi.");
  if (dns.NS.some((ns) => PARKING_NS.test(ns))) out.push("Name server riconducibili a servizi di parcheggio o hosting economico.");

  if (rdap?.registration) {
    const days = Math.floor((now.getTime() - new Date(rdap.registration).getTime()) / 86_400_000);
    if (days >= 0 && days < 30) out.push(`Dominio registrato di recente (${days} giorni fa).`);
    else if (days >= 30 && days < 180) out.push(`Dominio relativamente giovane (${days} giorni).`);
  }
  if (rdap?.expiration) {
    const days = Math.floor((new Date(rdap.expiration).getTime() - now.getTime()) / 86_400_000);
    if (days >= 0 && days < 30) out.push(`Scadenza della registrazione imminente (${days} giorni).`);
  }
  if (rdap?.status.some((s) => /hold|pendingdelete|redemption/i.test(s))) out.push(`Stato di registro anomalo: ${rdap.status.join(", ")}.`);
  return out;
}

/** Simulated data for reserved/documentation domains (training and demo). */
export function simulatedReport(domain: string, now: Date = new Date()): DomainReport {
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const ahead = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  const suspicious = /(supporto|pagamenti|verifica|login|secure|tracking|helpdesk|fatture)/.test(domain);

  const dns: DnsRecords = suspicious
    ? {
        A: ["203.0.113.66"],
        AAAA: [],
        MX: ["10 mail.hostveloce.example"],
        NS: ["ns1.hostveloce.example", "ns2.hostveloce.example"],
        TXT: ["v=spf1 +all"],
        DMARC: [],
      }
    : {
        A: ["198.51.100.10"],
        AAAA: ["2001:db8::10"],
        MX: [`10 mx1.${domain}`],
        NS: [`ns1.${domain}`, `ns2.${domain}`],
        TXT: ["v=spf1 ip4:198.51.100.0/28 -all"],
        DMARC: [`v=DMARC1; p=reject; rua=mailto:dmarc@${domain}`],
      };
  const rdap: RdapSummary = {
    registrar: suspicious ? "Registrar Economico Ltd (simulato)" : "Registrar Fittizio S.p.A. (simulato)",
    registration: suspicious ? ago(6) : ago(2900),
    expiration: suspicious ? ahead(359) : ahead(420),
    lastChanged: suspicious ? ago(6) : ago(60),
    status: suspicious ? ["client transfer prohibited"] : ["client delete prohibited", "client transfer prohibited"],
    nameservers: dns.NS,
    source: "dataset simulato",
  };
  return {
    domain,
    dataMode: "simulated",
    collectedAt: now.toISOString(),
    dns,
    dnsErrors: [],
    rdap,
    rdapError: null,
    anomalies: computeAnomalies(dns, rdap, now),
    limitations: [
      "Dominio riservato alla documentazione (RFC 2606/6761): i dati sono SIMULATI a scopo formativo e non derivano da interrogazioni reali.",
    ],
  };
}
