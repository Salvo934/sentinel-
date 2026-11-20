import { AlertTriangle, Info, Paperclip, ShieldAlert } from "lucide-react";

import { ToneBadge } from "@/components/common/tone-badge";
import type { Tone } from "@/lib/domain";

import type { AuthResult, ParsedEmail, Severity } from "../parser";

const SEV: Record<Severity, { tone: Tone; label: string }> = {
  high: { tone: "danger", label: "Alta" },
  medium: { tone: "warning", label: "Media" },
  low: { tone: "info", label: "Bassa" },
  info: { tone: "neutral", label: "Info" },
};

const authTone = (v: AuthResult): Tone => (v === "pass" ? "success" : v === "fail" || v === "permerror" ? "danger" : v === "unknown" ? "neutral" : "warning");

type Summary = Omit<ParsedEmail, "headers" | "body"> & { body?: string };

/** Read-only rendering of an analysis. Everything is plain text: no HTML is rendered, no link is clickable. */
export function AnalysisView({ analysis }: { analysis: Summary }) {
  const rows: [string, string | null][] = [
    ["Mittente (From)", [analysis.from.display, analysis.from.address && `<${analysis.from.address}>`].filter(Boolean).join(" ") || null],
    ["Reply-To", analysis.replyTo?.address ?? null],
    ["Return-Path", analysis.returnPath?.address ?? null],
    ["Destinatario", analysis.to],
    ["Oggetto", analysis.subject],
    ["Data", analysis.date],
    ["Message-ID", analysis.messageId],
  ];
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-sm font-semibold">Mittente e destinatario</h3>
        <dl className="divide-y rounded-lg border text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-3 py-1.5 sm:grid-cols-[140px_1fr]">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-mono text-xs break-all">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Autenticazione (dagli header del server ricevente)</h3>
        <div className="flex flex-wrap gap-2">
          {(["spf", "dkim", "dmarc"] as const).map((m) => (
            <ToneBadge key={m} tone={authTone(analysis.auth[m])}>
              {m.toUpperCase()}: {analysis.auth[m] === "unknown" ? "n/d" : analysis.auth[m]}
            </ToneBadge>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          SPF mail-from: <span className="font-mono">{analysis.auth.spfMailFrom ?? "—"}</span> · Dominio DKIM:{" "}
          <span className="font-mono">{analysis.auth.dkimDomain ?? "—"}</span>
        </p>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="size-4" aria-hidden="true" /> Elementi sospetti rilevati ({analysis.findings.length})
        </h3>
        {analysis.findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun indicatore automatico. Questo non dimostra che il messaggio sia legittimo.</p>
        ) : (
          <ul className="space-y-1.5">
            {analysis.findings.map((f) => (
              <li key={f.id} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                {f.severity === "high" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" /> : <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{f.title}</p>
                  <p className="text-xs break-all text-muted-foreground">{f.detail}</p>
                </div>
                <ToneBadge tone={SEV[f.severity].tone}>{SEV[f.severity].label}</ToneBadge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">URL estratti (testo inattivo, defanged)</h3>
        {analysis.urls.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun URL.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {analysis.urls.map((u) => (
              <li key={u.href} className="rounded-md bg-muted/50 px-2 py-1 font-mono break-all">
                {u.defanged}
                {u.text ? <span className="ml-2 font-sans text-muted-foreground">testo visibile: «{u.text}»</span> : null}
                {u.mismatch ? <ToneBadge tone="danger" className="ml-2">Destinazione diversa dal testo</ToneBadge> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-semibold">Percorso (Received)</h3>
          {analysis.received.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun header Received.</p>
          ) : (
            <ol className="space-y-1 text-xs">
              {analysis.received.map((r, i) => (
                <li key={i} className="rounded-md border px-2 py-1">
                  <span className="text-muted-foreground">#{i + 1}</span> from <span className="font-mono">{r.from ?? "?"}</span>
                  {r.ip ? <span className="font-mono"> [{r.ip}]</span> : null} → by <span className="font-mono">{r.by ?? "?"}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">Solo gli header aggiunti dai propri server sono affidabili; gli altri possono essere falsificati.</p>
        </section>
        <section>
          <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
            <Paperclip className="size-4" aria-hidden="true" /> Allegati (non aperti)
          </h3>
          {analysis.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun allegato dichiarato.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {analysis.attachments.map((a) => (
                <li key={a.filename} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                  <span className="font-mono break-all">{a.filename}</span>
                  {a.risky ? <ToneBadge tone="danger">Rischioso</ToneBadge> : <ToneBadge tone="neutral">—</ToneBadge>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
