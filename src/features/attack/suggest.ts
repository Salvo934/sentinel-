/**
 * ATT&CK technique suggestions derived from Sentinel's own analyses.
 * Suggestions are hints for the analyst, never automatic conclusions: each
 * one carries the observation that triggered it, and mapping it onto a case
 * is an explicit analyst action (default status: hypothesis).
 */
import type { DomainReport } from "@/features/domains/model";
import type { ParsedEmail } from "@/features/phishing/parser";

export type AttackSuggestion = { techniqueId: string; name: string; reason: string };

export const ATTACK_ID_RE = /^T\d{4}(\.\d{3})?$/;

function push(list: AttackSuggestion[], techniqueId: string, name: string, reason: string) {
  if (!list.some((s) => s.techniqueId === techniqueId)) list.push({ techniqueId, name, reason });
}

type EmailLike = Pick<ParsedEmail, "urls" | "attachments" | "findings">;

export function suggestFromEmail(email: EmailLike): AttackSuggestion[] {
  const out: AttackSuggestion[] = [];
  const ids = new Set(email.findings.map((f) => f.id));
  const has = (prefix: string) => [...ids].some((id) => id.startsWith(prefix));
  const riskyAttachment = email.attachments.some((a) => a.risky);
  const sensitive = ids.has("sensitive");

  if (riskyAttachment) {
    push(out, "T1566.001", "Spearphishing Attachment", "Il messaggio contiene un allegato potenzialmente attivo.");
    push(out, "T1204.002", "Malicious File", "L'attacco richiede che l'utente apra l'allegato.");
  }
  if (email.urls.length > 0) {
    push(out, "T1566.002", "Spearphishing Link", "Il messaggio contiene link verso risorse esterne.");
    if (has("link-mismatch") || has("link-ip") || has("link-puny") || has("link-short") || has("link-at")) {
      push(out, "T1204.001", "Malicious Link", "Il link è costruito per ingannare l'utente (destinazione mascherata).");
    }
  }
  if (sensitive && email.urls.length > 0) {
    push(out, "T1598.003", "Spearphishing Link (Phishing for Information)", "Il messaggio chiede credenziali o dati di pagamento tramite un link.");
  }
  if (ids.has("display-spoof") || ids.has("reply-to") || ids.has("reply-freemail") || ids.has("punycode-from")) {
    push(out, "T1684.001", "Impersonation", "Mittente, nome visualizzato o Reply-To imitano un soggetto fidato.");
  }
  if (ids.has("reply-freemail") || (ids.has("reply-to") && sensitive)) {
    push(out, "T1585.002", "Establish Accounts: Email Accounts", "Le risposte sono dirottate verso una casella controllata dall'attaccante.");
  }
  if (ids.has("reply-freemail") && sensitive) {
    push(out, "T1657", "Financial Theft", "Schema tipico del Business Email Compromise (richiesta di pagamento).");
  }
  if (has("link-ext") || ids.has("return-path") || ids.has("dkim-align")) {
    push(out, "T1583.001", "Acquire Infrastructure: Domains", "Sono coinvolti domini diversi da quello del mittente dichiarato.");
  }
  return out;
}

export function suggestFromDomain(report: Pick<DomainReport, "anomalies">): AttackSuggestion[] {
  const out: AttackSuggestion[] = [];
  const text = report.anomalies.join(" ").toLowerCase();
  if (/registrato di recente|relativamente giovane/.test(text)) {
    push(out, "T1583.001", "Acquire Infrastructure: Domains", "Dominio registrato di recente: possibile infrastruttura predisposta per una campagna.");
  }
  if (/spf permissivo|spf assente|dmarc assente/.test(text) && /registrato di recente/.test(text)) {
    push(out, "T1566.002", "Spearphishing Link", "Dominio giovane con configurazione email permissiva: adatto a invii fraudolenti.");
  }
  if (/parcheggio/.test(text)) {
    push(out, "T1608.005", "Stage Capabilities: Link Target", "Name server di parcheggio/hosting economico: possibile preparazione di pagine di destinazione.");
  }
  return out;
}
