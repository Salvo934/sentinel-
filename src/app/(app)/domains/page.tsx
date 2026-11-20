import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DemoBadge, RiskBadge } from "@/components/common/badges";
import { ToneBadge } from "@/components/common/tone-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCaseOptions, getMembers } from "@/features/cases/data";
import { DomainWorkbench } from "@/features/domains/components/domain-workbench";
import { ExportDomainPdfButton, type SavedDomainAnalysis } from "@/features/domains/components/export-domain-pdf";
import type { RiskLevel } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Domain Analysis" };

export default async function DomainsPage() {
  const { active, user } = await requireActiveOrg();
  const supabase = await createClient();
  const [cases, members, { data: saved }, { data: queries }] = await Promise.all([
    getCaseOptions(active.organizationId),
    getMembers(active.organizationId),
    supabase.from("domain_analyses").select("*, cases(case_ref)").eq("organization_id", active.organizationId).order("created_at", { ascending: false }).limit(50),
    supabase.from("osint_queries").select("id, query_type, query_value, provider, outcome, duration_ms, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Domain & URL Investigation" description="Analisi di domini: DNS (A, AAAA, MX, NS, TXT, DMARC), RDAP, osservazioni automatiche, valutazione motivata e collegamento ai casi." />
      <DomainWorkbench cases={cases} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Analisi salvate</CardTitle>
          </CardHeader>
          <CardContent>
            {(saved ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna analisi salvata.</p>
            ) : (
              <ul className="divide-y">
                {saved!.map((s) => {
                  const analysis: SavedDomainAnalysis = {
                    id: s.id,
                    domain: s.domain,
                    data_mode: s.data_mode,
                    dns: s.dns,
                    rdap: s.rdap,
                    anomalies: s.anomalies,
                    analyst_notes: s.analyst_notes,
                    risk_level: s.risk_level,
                    risk_rationale: s.risk_rationale,
                    created_at: s.created_at,
                    case_ref: (s.cases as { case_ref: string } | null)?.case_ref ?? null,
                    analyst: members.find((m) => m.user_id === s.created_by)?.full_name ?? "—",
                  };
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="font-mono text-sm">{s.domain}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(s.created_at)} · {s.data_mode === "live" ? "dati reali" : "dati simulati"}
                          {s.case_id ? (
                            <>
                              {" · "}
                              <Link href={`/investigations/${s.case_id}`} className="underline">
                                {analysis.case_ref}
                              </Link>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <RiskBadge value={s.risk_level as RiskLevel | null} />
                        <DemoBadge show={s.is_demo} />
                        <ExportDomainPdfButton analysis={analysis} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4" aria-hidden="true" /> Cronologia delle tue interrogazioni
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(queries ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna interrogazione.</p>
            ) : (
              <ul className="divide-y text-xs">
                {queries!.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="min-w-0 truncate">
                      <span className="font-mono">{q.query_value}</span> · {q.query_type.toUpperCase()} · {q.provider}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                      <ToneBadge tone={q.outcome === "ok" ? "success" : q.outcome === "error" || q.outcome === "rate_limited" ? "danger" : "neutral"}>{q.outcome}</ToneBadge>
                      {formatDateTime(q.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">Limite: 10 interrogazioni al minuto per utente; risultati in cache per 10 minuti.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
