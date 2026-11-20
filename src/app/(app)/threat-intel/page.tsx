import { PlugZap, Radar } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConfidenceBadge, DemoBadge, VerdictBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FormField, SelectInput, TextArea, TextInput } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCaseOptions, type IocRow } from "@/features/cases/data";
import { createIocAction, updateIocAction } from "@/features/osint/actions";
import { DeleteIocButton } from "@/features/osint/components/delete-buttons";
import { IocInput } from "@/features/osint/components/ioc-input";
import { IOC_TYPES, IOC_TYPE_VALUES, TLP, VERDICT_VALUES, options, type IocType, type Tlp } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { defang, isDocumentationIndicator } from "@/lib/indicators";
import { requireActiveOrg } from "@/lib/org";
import { firstParam } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Threat Intelligence" };

const INTEGRATIONS = [
  { name: "VirusTotal", env: "VIRUSTOTAL_API_KEY", note: "Reputazione di IP, domini, URL e hash" },
  { name: "AlienVault OTX", env: "OTX_API_KEY", note: "Pulse e indicatori della community" },
  { name: "NVD (CVE)", env: "NVD_API_KEY", note: "Vulnerabilità CVE (chiave facoltativa)" },
  { name: "MITRE ATT&CK", env: null, note: "Tecniche e tattiche (dataset STIX pubblico)" },
] as const;

type ResultRow = { id: string; indicator_id: string; provider: string; data_mode: string; result: Record<string, unknown>; checked_at: string };

export default async function ThreatIntelPage({ searchParams }: PageProps<"/threat-intel">) {
  const { active } = await requireActiveOrg();
  const sp = await searchParams;
  const caseId = firstParam(sp.case);
  const type = firstParam(sp.type);
  const verdict = firstParam(sp.verdict);
  const q = (firstParam(sp.q) ?? "").trim().slice(0, 200);

  const supabase = await createClient();
  let query = supabase.from("ioc_indicators").select("*, cases(case_ref)").eq("organization_id", active.organizationId);
  if (caseId) query = query.eq("case_id", caseId);
  if (type && (IOC_TYPE_VALUES as readonly string[]).includes(type)) query = query.eq("indicator_type", type);
  if (verdict && (VERDICT_VALUES as readonly string[]).includes(verdict)) query = query.eq("analyst_verdict", verdict);
  if (q) query = query.ilike("indicator_value", `%${q.replace(/[%_\\]/g, "")}%`);
  const [{ data }, cases] = await Promise.all([query.order("created_at", { ascending: false }).limit(300), getCaseOptions(active.organizationId)]);
  const iocs = (data ?? []) as (IocRow & { cases: { case_ref: string } | null })[];

  const ids = iocs.map((i) => i.id);
  const { data: results } = ids.length
    ? await supabase.from("ioc_analysis_results").select("*").in("indicator_id", ids).order("checked_at", { ascending: false })
    : { data: [] as ResultRow[] };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Threat Intelligence"
        description="Registro degli indicatori di compromissione: validazione del formato, verdetto dell'analista, livello di confidenza e collegamento ai casi."
      />

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <form className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(3,minmax(0,160px))_auto]">
            <TextInput name="q" defaultValue={q} placeholder="Cerca indicatore" aria-label="Cerca indicatore" className="font-mono" />
            <SelectInput name="type" options={options.iocTypes} defaultValue={type} placeholder="Ogni tipo" />
            <SelectInput name="verdict" options={options.verdicts} defaultValue={verdict} placeholder="Ogni verdetto" />
            <SelectInput name="case" options={cases} defaultValue={caseId} placeholder="Tutti i casi" />
            <Button type="submit" variant="secondary">
              Filtra
            </Button>
          </form>

          {iocs.length === 0 ? (
            <EmptyState icon={Radar} title="Nessun indicatore">
              Aggiungi un IOC con il modulo a lato. Gli indicatori sono mostrati in forma «defanged» e non sono mai cliccabili.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {iocs.map((i) => {
                const own = (results ?? []).filter((r) => r.indicator_id === i.id) as ResultRow[];
                return (
                  <li key={i.id}>
                    <Card size="sm">
                      <CardContent className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-sm break-all">{defang(i.indicator_value)}</p>
                            <p className="text-xs text-muted-foreground">
                              {IOC_TYPES[i.indicator_type as IocType]} · {i.source ?? "fonte non indicata"} · {formatDateTime(i.created_at)}
                              {i.cases ? (
                                <>
                                  {" · "}
                                  <Link href={`/investigations/${i.case_id}?tab=intel`} className="underline">
                                    {i.cases.case_ref}
                                  </Link>
                                </>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <DemoBadge show={i.is_demo} />
                            <DeleteIocButton id={i.id} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <VerdictBadge value={i.analyst_verdict} />
                          <ConfidenceBadge value={i.confidence} />
                          <ToneBadge tone={i.tlp === "red" ? "danger" : i.tlp.startsWith("amber") ? "warning" : i.tlp === "green" ? "success" : "neutral"}>
                            {TLP[i.tlp as Tlp]}
                          </ToneBadge>
                          {isDocumentationIndicator(i.indicator_type as IocType, i.indicator_value) ? (
                            <ToneBadge tone="neutral">Range di documentazione</ToneBadge>
                          ) : null}
                        </div>
                        {i.analyst_notes ? <p className="text-sm text-muted-foreground">{i.analyst_notes}</p> : null}

                        {own.length ? (
                          <div className="rounded-md border bg-muted/30 p-2">
                            <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                              Reputazione riportata dalle fonti (non è la valutazione dell&apos;analista)
                            </p>
                            <ul className="space-y-1 text-xs">
                              {own.map((r) => (
                                <li key={r.id}>
                                  <span className="font-medium">{r.provider}</span>
                                  {r.data_mode === "simulated" ? <span className="ml-1 text-warning">(simulato)</span> : null}:{" "}
                                  <code className="break-all">{JSON.stringify(r.result)}</code>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <details>
                          <summary className="cursor-pointer text-xs text-primary">Valutazione dell&apos;analista</summary>
                          <ActionForm action={updateIocAction.bind(null, i.id)} successMessage="Indicatore aggiornato" className="mt-2 grid gap-2 sm:grid-cols-2">
                            <FormField label="Verdetto" htmlFor={`v-${i.id}`}>
                              <SelectInput id={`v-${i.id}`} name="analyst_verdict" options={options.verdicts} defaultValue={i.analyst_verdict} />
                            </FormField>
                            <FormField label="Confidenza" htmlFor={`c-${i.id}`}>
                              <SelectInput id={`c-${i.id}`} name="confidence" options={options.confidence} defaultValue={i.confidence} />
                            </FormField>
                            <FormField label="TLP" htmlFor={`t-${i.id}`}>
                              <SelectInput id={`t-${i.id}`} name="tlp" options={options.tlp} defaultValue={i.tlp} />
                            </FormField>
                            <FormField label="Caso" htmlFor={`k-${i.id}`}>
                              <SelectInput id={`k-${i.id}`} name="case_id" options={cases} defaultValue={i.case_id} placeholder="— Nessuno —" />
                            </FormField>
                            <FormField label="Note" htmlFor={`n-${i.id}`} className="sm:col-span-2">
                              <TextArea id={`n-${i.id}`} name="analyst_notes" rows={2} defaultValue={i.analyst_notes ?? ""} />
                            </FormField>
                            <SubmitButton size="sm" variant="outline">
                              Salva valutazione
                            </SubmitButton>
                          </ActionForm>
                        </details>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nuovo indicatore</CardTitle>
              <CardDescription>Il formato viene validato prima del salvataggio, nel browser e sul server.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm action={createIocAction} successMessage="Indicatore registrato" resetOnSuccess className="grid gap-3 md:grid-cols-2">
                <IocInput />
                <FormField label="Caso" htmlFor="case_id" className="md:col-span-2">
                  <SelectInput name="case_id" options={cases} defaultValue={caseId} placeholder="— Nessuno —" />
                </FormField>
                <FormField label="Fonte dell'indicatore" htmlFor="source" className="md:col-span-2">
                  <TextInput name="source" placeholder="Es. header email, report di un vendor" />
                </FormField>
                <FormField label="Verdetto" htmlFor="analyst_verdict">
                  <SelectInput name="analyst_verdict" options={options.verdicts} defaultValue="undetermined" />
                </FormField>
                <FormField label="Confidenza" htmlFor="confidence">
                  <SelectInput name="confidence" options={options.confidence} defaultValue="low" />
                </FormField>
                <FormField label="TLP" htmlFor="tlp">
                  <SelectInput name="tlp" options={options.tlp} defaultValue="amber" />
                </FormField>
                <FormField label="Note" htmlFor="analyst_notes" className="md:col-span-2">
                  <TextArea name="analyst_notes" rows={2} />
                </FormField>
                <div className="md:col-span-2">
                  <SubmitButton>Registra indicatore</SubmitButton>
                </div>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlugZap className="size-4" aria-hidden="true" /> Integrazioni esterne
              </CardTitle>
              <CardDescription>
                Pianificate per la Fase 2: chiamate solo lato server, con rate limiting, caching, timeout e log delle
                interrogazioni. Nessun file riservato, URL interno o dato personale viene inviato automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {INTEGRATIONS.map((it) => {
                  const configured = it.env ? Boolean(process.env[it.env]) : false;
                  return (
                    <li key={it.name} className="flex items-center justify-between gap-2 py-2">
                      <div>
                        <p className="font-medium">{it.name}</p>
                        <p className="text-xs text-muted-foreground">{it.note}</p>
                      </div>
                      <ToneBadge tone="neutral">{configured ? "Chiave presente · Fase 2" : "Fase 2"}</ToneBadge>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
