import { ExternalLink, ScanSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DemoBadge, InfoStatusBadge, ReliabilityBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FormField, SelectInput, TextArea, TextInput } from "@/components/forms/fields";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCaseOptions, type FindingRow } from "@/features/cases/data";
import { createFindingAction, createSourceAction, updateFindingStatusAction } from "@/features/osint/actions";
import { DeleteFindingButton } from "@/features/osint/components/delete-buttons";
import { INFO_STATUSES, INFO_STATUS_VALUES, RELIABILITY_VALUES, SOURCE_TYPES, options, type SourceType } from "@/lib/domain";
import { formatDateTime, toDateTimeLocal } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { firstParam } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "OSINT Workspace" };

export default async function OsintPage({ searchParams }: PageProps<"/osint">) {
  const { active } = await requireActiveOrg();
  const sp = await searchParams;
  const caseId = firstParam(sp.case);
  const status = firstParam(sp.status);
  const reliability = firstParam(sp.reliability);
  const q = (firstParam(sp.q) ?? "").trim().slice(0, 100);

  const supabase = await createClient();
  let query = supabase.from("osint_findings").select("*, cases(case_ref, title)").eq("organization_id", active.organizationId);
  if (caseId) query = query.eq("case_id", caseId);
  if (status && (INFO_STATUS_VALUES as readonly string[]).includes(status)) query = query.eq("info_status", status);
  if (reliability && (RELIABILITY_VALUES as readonly string[]).includes(reliability)) query = query.eq("reliability", reliability);
  if (q) {
    const safe = q.replace(/[%_\\,()*]/g, " ");
    query = query.or(`title.ilike.%${safe}%,subject.ilike.%${safe}%,data.ilike.%${safe}%`);
  }
  const [{ data }, { data: sources }, cases] = await Promise.all([
    query.order("collected_at", { ascending: false }).limit(200),
    supabase.from("osint_sources").select("*").eq("organization_id", active.organizationId).order("name"),
    getCaseOptions(active.organizationId),
  ]);
  const findings = (data ?? []) as (FindingRow & { cases: { case_ref: string; title: string } | null })[];
  const sourceOptions = (sources ?? []).map((s) => [s.id as string, s.name as string] as const);
  const contradictory = findings.filter((f) => f.info_status === "contradictory").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="OSINT Workspace"
        description="Raccolta e organizzazione delle informazioni da fonti aperte. Ogni risultato riporta fonte, data, metodo, affidabilità, stato di verifica e limitazioni."
      />
      <FormAlert tone="info" title="Principi operativi">
        Usa solo fonti lecitamente accessibili; evita tecniche invasive, accessi non autorizzati e la raccolta
        indiscriminata di dati personali. Etichetta sempre in modo esplicito fatti verificati, informazioni da
        verificare, ipotesi e informazioni contraddittorie.
      </FormAlert>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <form className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(3,minmax(0,170px))_auto]">
            <TextInput name="q" defaultValue={q} placeholder="Cerca nei risultati" aria-label="Cerca" />
            <SelectInput name="case" options={cases} defaultValue={caseId} placeholder="Tutti i casi" />
            <SelectInput name="status" options={options.infoStatuses} defaultValue={status} placeholder="Ogni stato" />
            <SelectInput name="reliability" options={options.reliability} defaultValue={reliability} placeholder="Ogni affidabilità" />
            <Button type="submit" variant="secondary">
              Filtra
            </Button>
          </form>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{findings.length} risultati</span>
            {contradictory ? <ToneBadge tone="danger">{contradictory} informazioni contraddittorie da approfondire</ToneBadge> : null}
          </div>

          {findings.length === 0 ? (
            <EmptyState icon={ScanSearch} title="Nessun risultato OSINT">
              Registra il primo risultato con il modulo a lato, oppure carica i dati demo dalle impostazioni.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {findings.map((f) => (
                <li key={f.id}>
                  <Card size="sm">
                    <CardContent className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{f.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.subject ? `Soggetto: ${f.subject} · ` : ""}
                            {f.cases ? (
                              <Link href={`/investigations/${f.case_id}?tab=intel`} className="underline">
                                {f.cases.case_ref}
                              </Link>
                            ) : (
                              "Non collegato a un caso"
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <DemoBadge show={f.is_demo} />
                          <DeleteFindingButton id={f.id} />
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{f.data}</p>
                      <div className="flex flex-wrap gap-1">
                        <InfoStatusBadge value={f.info_status} />
                        <ReliabilityBadge value={f.reliability} />
                      </div>
                      <dl className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <div>
                          <dt className="inline font-medium text-foreground">Fonte: </dt>
                          <dd className="inline">{f.source_name}</dd>
                        </div>
                        <div>
                          <dt className="inline font-medium text-foreground">Raccolto il: </dt>
                          <dd className="inline">{formatDateTime(f.collected_at)}</dd>
                        </div>
                        <div>
                          <dt className="inline font-medium text-foreground">Metodo: </dt>
                          <dd className="inline">{f.acquisition_method}</dd>
                        </div>
                        {f.source_url ? (
                          <div className="min-w-0">
                            <dt className="inline font-medium text-foreground">URL (non visitato): </dt>
                            <dd className="inline font-mono break-all">{f.source_url}</dd>
                          </div>
                        ) : null}
                        {f.verification_notes ? (
                          <div className="sm:col-span-2">
                            <dt className="inline font-medium text-foreground">Verifica: </dt>
                            <dd className="inline">{f.verification_notes}</dd>
                          </div>
                        ) : null}
                        <div className="sm:col-span-2">
                          <dt className="inline font-medium text-foreground">Limitazioni: </dt>
                          <dd className="inline">{f.limitations ?? "non indicate"}</dd>
                        </div>
                      </dl>
                      <details>
                        <summary className="cursor-pointer text-xs text-primary">Aggiorna verifica</summary>
                        <ActionForm action={updateFindingStatusAction.bind(null, f.id)} successMessage="Verifica aggiornata" className="mt-2 grid gap-2 sm:grid-cols-2">
                          <SelectInput id={`st-${f.id}`} name="info_status" options={options.infoStatuses} defaultValue={f.info_status} />
                          <SelectInput id={`rl-${f.id}`} name="reliability" options={options.reliability} defaultValue={f.reliability} />
                          <TextArea id={`vn-${f.id}`} name="verification_notes" rows={2} defaultValue={f.verification_notes ?? ""} placeholder="Come è stata verificata?" className="sm:col-span-2" />
                          <SubmitButton size="sm" variant="outline">
                            Salva
                          </SubmitButton>
                        </ActionForm>
                      </details>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nuovo risultato</CardTitle>
              <CardDescription>Tutti i campi obbligatori documentano la provenienza dell&apos;informazione.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm action={createFindingAction} successMessage="Risultato registrato" resetOnSuccess className="grid gap-3">
                <FormField label="Titolo" htmlFor="title" required>
                  <TextInput name="title" required />
                </FormField>
                <FormField label="Soggetto (organizzazione, dominio, IP, URL)" htmlFor="subject">
                  <TextInput name="subject" />
                </FormField>
                <FormField label="Caso collegato" htmlFor="case_id">
                  <SelectInput name="case_id" options={cases} defaultValue={caseId} placeholder="— Nessuno —" />
                </FormField>
                <FormField label="Fonte registrata" htmlFor="source_id">
                  <SelectInput name="source_id" options={sourceOptions} placeholder="— Nessuna —" />
                </FormField>
                <FormField label="Nome della fonte" htmlFor="source_name" required>
                  <TextInput name="source_name" required />
                </FormField>
                <FormField label="URL della fonte" htmlFor="source_url" hint="Registrato come testo: la piattaforma non lo visita.">
                  <TextInput name="source_url" type="url" placeholder="https://" />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Data e ora della raccolta" htmlFor="collected_at" required>
                    <TextInput name="collected_at" type="datetime-local" defaultValue={toDateTimeLocal(new Date())} required />
                  </FormField>
                  <FormField label="Metodo di acquisizione" htmlFor="acquisition_method" required>
                    <TextInput name="acquisition_method" placeholder="Es. consultazione registro" required />
                  </FormField>
                </div>
                <FormField label="Dati ottenuti" htmlFor="data" required>
                  <TextArea name="data" rows={4} required />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Affidabilità della fonte" htmlFor="reliability" required>
                    <SelectInput name="reliability" options={options.reliability} defaultValue="F" />
                  </FormField>
                  <FormField label="Stato dell'informazione" htmlFor="info_status" required>
                    <SelectInput name="info_status" options={options.infoStatuses} defaultValue="to_verify" />
                  </FormField>
                </div>
                <FormField label="Note di verifica" htmlFor="verification_notes">
                  <TextArea name="verification_notes" rows={2} />
                </FormField>
                <FormField label="Limitazioni" htmlFor="limitations">
                  <TextArea name="limitations" rows={2} placeholder="Copertura, attualità, possibili errori della fonte…" />
                </FormField>
                <SubmitButton>Registra risultato</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registro delle fonti</CardTitle>
              <CardDescription>Legenda stati: {Object.values(INFO_STATUSES).join(" · ")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(sources ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessuna fonte registrata.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {sources!.map((s) => (
                    <li key={s.id} className="py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{s.name}</span>
                        <ReliabilityBadge value={s.default_reliability} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {SOURCE_TYPES[s.source_type as SourceType]}
                        {s.url ? (
                          <span className="ml-1 inline-flex items-center gap-0.5 font-mono">
                            <ExternalLink className="size-3" aria-hidden="true" />
                            {s.url}
                          </span>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <details>
                <summary className="cursor-pointer text-sm text-primary">Aggiungi fonte</summary>
                <ActionForm action={createSourceAction} successMessage="Fonte aggiunta" resetOnSuccess className="mt-3 grid gap-3">
                  <FormField label="Nome" htmlFor="src-name" required>
                    <TextInput id="src-name" name="name" required />
                  </FormField>
                  <FormField label="Tipologia" htmlFor="src-type">
                    <SelectInput id="src-type" name="source_type" options={options.sourceTypes} defaultValue="other" />
                  </FormField>
                  <FormField label="URL" htmlFor="src-url">
                    <TextInput id="src-url" name="url" type="url" />
                  </FormField>
                  <FormField label="Affidabilità predefinita" htmlFor="src-rel">
                    <SelectInput id="src-rel" name="default_reliability" options={options.reliability} defaultValue="F" />
                  </FormField>
                  <FormField label="Descrizione" htmlFor="src-desc">
                    <TextArea id="src-desc" name="description" rows={2} />
                  </FormField>
                  <SubmitButton size="sm">Aggiungi</SubmitButton>
                </ActionForm>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
