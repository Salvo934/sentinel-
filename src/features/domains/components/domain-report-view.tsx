import { AlertTriangle, FlaskConical } from "lucide-react";
import Link from "next/link";

import { ToneBadge } from "@/components/common/tone-badge";
import { formatDate, formatDateTime } from "@/lib/format";

import type { LinkedCase } from "../actions";
import type { DomainReport } from "../model";

export function DomainReportView({ report, linkedCases }: { report: DomainReport; linkedCases?: LinkedCase[] }) {
  const rec: [string, string[]][] = [
    ["A", report.dns.A],
    ["AAAA", report.dns.AAAA],
    ["MX", report.dns.MX],
    ["NS", report.dns.NS],
    ["TXT", report.dns.TXT],
    ["_dmarc TXT", report.dns.DMARC],
  ];
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-semibold">{report.domain}</span>
        <ToneBadge tone="success">Formato valido</ToneBadge>
        {report.dataMode === "simulated" ? (
          <ToneBadge tone="warning">
            <FlaskConical className="size-3" /> Dati simulati
          </ToneBadge>
        ) : (
          <ToneBadge tone="info">Dati reali (raccolta passiva)</ToneBadge>
        )}
        <span className="text-xs text-muted-foreground">Raccolti il {formatDateTime(report.collectedAt)}</span>
      </div>

      <section>
        <h3 className="mb-1.5 font-semibold">Record DNS</h3>
        <div className="divide-y rounded-lg border">
          {rec.map(([type, values]) => (
            <div key={type} className="grid gap-1 px-3 py-1.5 sm:grid-cols-[100px_1fr]">
              <span className="font-mono text-xs text-muted-foreground">{type}</span>
              <span className="font-mono text-xs break-all">{values.length ? values.join("\n") : "—"}</span>
            </div>
          ))}
        </div>
        {report.dnsErrors.length ? <p className="mt-1 text-xs text-warning">{report.dnsErrors.join(" · ")}</p> : null}
      </section>

      <section>
        <h3 className="mb-1.5 font-semibold">RDAP</h3>
        {report.rdap ? (
          <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            <div>
              <dt className="inline text-muted-foreground">Registrar: </dt>
              <dd className="inline">{report.rdap.registrar ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Fonte: </dt>
              <dd className="inline font-mono">{report.rdap.source}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Registrazione: </dt>
              <dd className="inline">{report.rdap.registration ? formatDate(report.rdap.registration) : "—"}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Scadenza: </dt>
              <dd className="inline">{report.rdap.expiration ? formatDate(report.rdap.expiration) : "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="inline text-muted-foreground">Stato: </dt>
              <dd className="inline">{report.rdap.status.join(", ") || "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">{report.rdapError ?? "Non disponibile."}</p>
        )}
      </section>

      <section>
        <h3 className="mb-1.5 font-semibold">Certificato TLS</h3>
        <p className="text-xs text-muted-foreground">Pianificato (Fase 2) tramite log di Certificate Transparency: nessuna connessione diretta al dominio.</p>
      </section>

      <section>
        <h3 className="mb-1.5 font-semibold">Osservazioni automatiche</h3>
        {report.anomalies.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nessuna anomalia rilevata dalle regole: non equivale a un giudizio di affidabilità.</p>
        ) : (
          <ul className="space-y-1">
            {report.anomalies.map((a) => (
              <li key={a} className="flex items-start gap-2 text-xs">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" /> {a}
              </li>
            ))}
          </ul>
        )}
      </section>

      {linkedCases ? (
        <section>
          <h3 className="mb-1.5 font-semibold">Collegamenti con casi esistenti</h3>
          {linkedCases.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun caso collegato a questo dominio.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {linkedCases.map((c) => (
                <li key={c.id}>
                  <Link href={`/investigations/${c.id}`} className="underline">
                    {c.case_ref} · {c.title}
                  </Link>{" "}
                  <span className="text-muted-foreground">({c.via})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section>
        <h3 className="mb-1.5 font-semibold">Limitazioni</h3>
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {report.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
