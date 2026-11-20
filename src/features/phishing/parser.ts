/**
 * Static, offline analysis of a raw email (RFC 5322 text).
 *
 * Safety: this module never fetches URLs, never decodes/executes attachments
 * and never renders HTML. Links are extracted as inert text. The findings are
 * indicators to support the analyst, NOT an automatic verdict.
 */
import { defang, isIPv4 } from "@/lib/indicators";

export type Header = { name: string; value: string };
export type Address = { display: string | null; address: string | null; domain: string | null };
export type AuthResult = "pass" | "fail" | "softfail" | "neutral" | "none" | "temperror" | "permerror" | "policy" | "unknown";
export type Severity = "high" | "medium" | "low" | "info";
export type Finding = { id: string; severity: Severity; title: string; detail: string };
export type ExtractedUrl = { href: string; defanged: string; host: string | null; text: string | null; mismatch: boolean };
export type Attachment = { filename: string; risky: boolean; reason: string | null };
export type ReceivedHop = { raw: string; from: string | null; by: string | null; ip: string | null };

export type ParsedEmail = {
  headers: Header[];
  from: Address;
  replyTo: Address | null;
  returnPath: Address | null;
  to: string | null;
  subject: string | null;
  date: string | null;
  messageId: string | null;
  received: ReceivedHop[];
  auth: { spf: AuthResult; dkim: AuthResult; dmarc: AuthResult; dkimDomain: string | null; spfMailFrom: string | null };
  body: string;
  urls: ExtractedUrl[];
  ips: string[];
  attachments: Attachment[];
  findings: Finding[];
};

const MAX_INPUT = 200_000;

export function splitMessage(raw: string): { headerText: string; body: string } {
  const text = raw.replace(/\r\n/g, "\n").slice(0, MAX_INPUT);
  const idx = text.search(/\n\s*\n/);
  if (idx === -1) return { headerText: text, body: "" };
  return { headerText: text.slice(0, idx), body: text.slice(idx).replace(/^\s*\n/, "") };
}

/** Unfolds continuation lines (RFC 5322 §2.2.3). */
export function parseHeaders(headerText: string): Header[] {
  const headers: Header[] = [];
  for (const line of headerText.split("\n")) {
    if (/^[ \t]/.test(line) && headers.length) {
      headers[headers.length - 1]!.value += ` ${line.trim()}`;
      continue;
    }
    const m = line.match(/^([!-9;-~]+):\s?(.*)$/);
    if (m) headers.push({ name: m[1]!, value: m[2]!.trim() });
  }
  return headers;
}

const get = (headers: Header[], name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
const getAll = (headers: Header[], name: string) => headers.filter((h) => h.name.toLowerCase() === name.toLowerCase()).map((h) => h.value);

export function parseAddress(value: string | null): Address | null {
  if (!value) return null;
  const angle = value.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>/);
  const address = (angle ? angle[2] : value.match(/[^\s<>"]+@[^\s<>"]+/)?.[0])?.trim().toLowerCase() ?? null;
  const display = angle?.[1]?.trim() || null;
  const domain = address?.includes("@") ? address.split("@").pop()!.replace(/[>.]+$/, "") : null;
  return { display, address, domain };
}

const SECOND_LEVEL = new Set(["co.uk", "org.uk", "ac.uk", "com.au", "net.au", "co.jp", "com.br", "co.nz", "co.za", "com.tr"]);

/** Approximate registrable domain (eTLD+1) without the full Public Suffix List. */
export function registrableDomain(host: string | null): string | null {
  if (!host) return null;
  const h = host.toLowerCase().replace(/\.$/, "");
  if (isIPv4(h)) return h;
  const labels = h.split(".");
  if (labels.length <= 2) return h;
  const lastTwo = labels.slice(-2).join(".");
  return SECOND_LEVEL.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

function authValue(text: string, method: "spf" | "dkim" | "dmarc"): AuthResult {
  const m = text.match(new RegExp(`\\b${method}=([a-z]+)`, "i"));
  const v = m?.[1]?.toLowerCase();
  const known: AuthResult[] = ["pass", "fail", "softfail", "neutral", "none", "temperror", "permerror", "policy"];
  return (known as string[]).includes(v ?? "") ? (v as AuthResult) : "unknown";
}

function parseReceived(value: string): ReceivedHop {
  const from = value.match(/\bfrom\s+([^\s(;]+)/i)?.[1] ?? null;
  const by = value.match(/\bby\s+([^\s(;]+)/i)?.[1] ?? null;
  const ip = value.match(/\[(\d{1,3}(?:\.\d{1,3}){3})\]/)?.[1] ?? value.match(/\((?:[^)]*?)(\d{1,3}(?:\.\d{1,3}){3})(?:[^)]*)\)/)?.[1] ?? null;
  return { raw: value, from, by, ip: ip && isIPv4(ip) ? ip : null };
}

const URL_RE = /\bhttps?:\/\/[^\s"'<>()\]]+/gi;
const ANCHOR_RE = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function extractUrls(body: string): ExtractedUrl[] {
  const out = new Map<string, ExtractedUrl>();
  for (const m of body.matchAll(ANCHOR_RE)) {
    const href = m[1]!.trim();
    if (!/^https?:\/\//i.test(href)) continue;
    const text = m[2]!.replace(/<[^>]+>/g, "").trim();
    const textHost = hostOf(text.startsWith("http") ? text : /^[\w.-]+\.[a-z]{2,}/i.test(text) ? `http://${text}` : "");
    const host = hostOf(href);
    const mismatch = Boolean(textHost && host && registrableDomain(textHost) !== registrableDomain(host));
    out.set(href, { href, defanged: defang(href), host, text: text || null, mismatch });
  }
  const withoutAnchors = body.replace(ANCHOR_RE, " ");
  for (const m of withoutAnchors.matchAll(URL_RE)) {
    const href = m[0].replace(/[.,;:!?]+$/, "");
    if (!out.has(href)) out.set(href, { href, defanged: defang(href), host: hostOf(href), text: null, mismatch: false });
  }
  return [...out.values()].slice(0, 100);
}

const RISKY_EXT = /\.(html?|shtml|svg|js|jse|vbs|vbe|wsf|hta|exe|scr|com|bat|cmd|ps1|msi|lnk|iso|img|vhd|one|jar|docm|xlsm|pptm|zip|rar|7z)$/i;

export function extractAttachments(raw: string): Attachment[] {
  const names = new Set<string>();
  for (const m of raw.matchAll(/(?:filename|name)\*?=\s*"?([^";\n]+)"?/gi)) names.add(m[1]!.trim());
  for (const m of raw.matchAll(/^Allegato:\s*(.+)$/gim)) names.add(m[1]!.trim());
  return [...names].slice(0, 50).map((filename) => {
    const double = /\.[a-z0-9]{2,4}\.[a-z0-9]{2,5}$/i.test(filename) && RISKY_EXT.test(filename);
    const risky = RISKY_EXT.test(filename);
    return {
      filename,
      risky,
      reason: double ? "Doppia estensione con formato potenzialmente attivo" : risky ? "Formato che può contenere codice o contenuti attivi" : null,
    };
  });
}

const URGENCY = /\b(urgent[ei]?|immediatamente|entro (24|48) ore|sospes[oa]|bloccat[oa]|scadut[oa]|ultimo avviso|azione richiesta|immediately|suspended|final notice|action required)\b/i;
const SENSITIVE = /\b(password|credenziali|codice (otp|di sicurezza)|pin|iban|bonifico|carta di credito|dati di pagamento|login|accedi|wire transfer|gift card)\b/i;
const FREEMAIL = /^(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|libero\.it|virgilio\.it|proton\.me|protonmail\.com|icloud\.com)$/;
const SHORTENERS = /^(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|cutt\.ly|rebrand\.ly)$/;

export function analyzeEmail(raw: string): ParsedEmail {
  const { headerText, body } = splitMessage(raw);
  const headers = parseHeaders(headerText);
  const from = parseAddress(get(headers, "From")) ?? { display: null, address: null, domain: null };
  const replyTo = parseAddress(get(headers, "Reply-To"));
  const returnPath = parseAddress(get(headers, "Return-Path"));
  const authText = [...getAll(headers, "Authentication-Results"), ...getAll(headers, "ARC-Authentication-Results")].join(" ; ");
  const receivedSpf = get(headers, "Received-SPF");
  const dkimSig = get(headers, "DKIM-Signature");
  const dkimDomain =
    authText.match(/header\.d=([^\s;]+)/i)?.[1]?.toLowerCase() ?? dkimSig?.match(/\bd=([^\s;]+)/i)?.[1]?.toLowerCase() ?? null;
  const spfMailFrom = authText.match(/smtp\.mailfrom=([^\s;]+)/i)?.[1]?.toLowerCase() ?? null;

  let spf = authValue(authText, "spf");
  if (spf === "unknown" && receivedSpf) spf = (receivedSpf.split(/\s/)[0]?.toLowerCase() as AuthResult) ?? "unknown";
  const auth = { spf, dkim: authValue(authText, "dkim"), dmarc: authValue(authText, "dmarc"), dkimDomain, spfMailFrom };

  const received = getAll(headers, "Received").map(parseReceived);
  const urls = extractUrls(body);
  const attachments = extractAttachments(raw);
  const ips = [...new Set(received.map((r) => r.ip).filter((x): x is string => Boolean(x)))];

  const findings: Finding[] = [];
  const add = (id: string, severity: Severity, title: string, detail: string) => findings.push({ id, severity, title, detail });
  const fromReg = registrableDomain(from.domain);

  for (const method of ["spf", "dkim", "dmarc"] as const) {
    const v = auth[method];
    if (v === "fail" || v === "permerror") add(`auth-${method}`, "high", `${method.toUpperCase()}: ${v}`, `La verifica ${method.toUpperCase()} non è superata.`);
    else if (v === "softfail" || v === "none" || v === "neutral")
      add(`auth-${method}`, "medium", `${method.toUpperCase()}: ${v}`, `La verifica ${method.toUpperCase()} non fornisce garanzie sul mittente.`);
    else if (v === "unknown") add(`auth-${method}`, "info", `${method.toUpperCase()}: non disponibile`, "Nessun risultato presente negli header analizzati.");
  }
  if (replyTo?.domain && fromReg && registrableDomain(replyTo.domain) !== fromReg) {
    add("reply-to", "high", "Reply-To su dominio diverso", `Le risposte andrebbero a ${replyTo.address}, non al dominio del mittente (${from.domain}).`);
  }
  if (replyTo?.domain && FREEMAIL.test(replyTo.domain) && fromReg && !FREEMAIL.test(fromReg)) {
    add("reply-freemail", "high", "Reply-To su webmail gratuita", "Schema tipico del Business Email Compromise.");
  }
  if (returnPath?.domain && fromReg && registrableDomain(returnPath.domain) !== fromReg) {
    add("return-path", "medium", "Return-Path non allineato", `Il bounce va a ${returnPath.domain}, diverso da ${from.domain}.`);
  }
  if (auth.dkimDomain && fromReg && registrableDomain(auth.dkimDomain) !== fromReg) {
    add("dkim-align", "medium", "Firma DKIM di un dominio diverso", `Firmato da ${auth.dkimDomain}, non da ${from.domain}.`);
  }
  if (from.display && /@/.test(from.display)) {
    const shown = from.display.match(/[^\s<>"]+@[^\s<>"]+/)?.[0]?.toLowerCase();
    if (shown && shown !== from.address) add("display-spoof", "high", "Nome visualizzato con indirizzo diverso", `Mostra ${shown} ma l'indirizzo reale è ${from.address}.`);
  }
  if (from.domain?.includes("xn--")) add("punycode-from", "high", "Dominio mittente in punycode", "Possibile omografo (caratteri simili a quelli latini).");
  const subject = get(headers, "Subject");
  if (URGENCY.test(`${subject ?? ""} ${body}`)) add("urgency", "medium", "Linguaggio di urgenza o minaccia", "Leva psicologica tipica dell'ingegneria sociale.");
  if (SENSITIVE.test(body)) add("sensitive", "medium", "Richiesta di credenziali o pagamenti", "Il messaggio richiama dati sensibili, accessi o pagamenti.");

  for (const u of urls) {
    if (u.mismatch) add(`link-mismatch-${u.host}`, "high", "Testo del link diverso dalla destinazione", `Mostra «${u.text}» ma punta a ${u.host}.`);
    if (u.host && isIPv4(u.host)) add(`link-ip-${u.host}`, "high", "Link verso indirizzo IP", u.defanged);
    if (u.host?.includes("xn--")) add(`link-puny-${u.host}`, "high", "Link verso dominio punycode", u.defanged);
    if (u.host && SHORTENERS.test(u.host)) add(`link-short-${u.host}`, "medium", "URL abbreviato", "La destinazione reale è nascosta.");
    if (u.href.startsWith("http://")) add(`link-http-${u.host}`, "low", "Link non cifrato (http)", u.defanged);
    if (u.href.includes("@")) add(`link-at-${u.host}`, "high", "URL con carattere @", "Tecnica per mascherare l'host reale.");
    if (u.host && fromReg && registrableDomain(u.host) !== fromReg && !u.mismatch)
      add(`link-ext-${u.host}`, "low", "Link verso dominio esterno al mittente", u.defanged);
  }
  for (const a of attachments) if (a.risky) add(`att-${a.filename}`, "high", `Allegato rischioso: ${a.filename}`, a.reason ?? "");

  // De-duplicate by id, keep first.
  const seen = new Set<string>();
  const unique = findings.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };
  unique.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    headers,
    from,
    replyTo,
    returnPath,
    to: get(headers, "To"),
    subject,
    date: get(headers, "Date"),
    messageId: get(headers, "Message-ID"),
    received,
    auth,
    body: body.slice(0, 20_000),
    urls,
    ips,
    attachments,
    findings: unique,
  };
}
