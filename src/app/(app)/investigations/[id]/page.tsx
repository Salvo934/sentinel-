import { CalendarClock, Crosshair, FilePlus2, FileText, FolderLock, History, ListTodo, Plus, Radar, ScanSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CaseStatusBadge,
  DemoBadge,
  InfoStatusBadge,
  PriorityBadge,
  ReliabilityBadge,
  RiskBadge,
  VerdictBadge,
} from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FormField, SelectInput, TextInput } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateMappingAction } from "@/features/attack/actions";
import { MapTechniqueForm } from "@/features/attack/components/map-technique-form";
import { DeleteMappingButton } from "@/features/attack/components/mapping-controls";
import { getTactics, getTechniqueIndex, techniqueOptions } from "@/features/attack/data";
import { TACTIC_GUIDE } from "@/features/attack/guide";
import { createEventAction, createTaskAction, updateCaseAction, updateEventAction } from "@/features/cases/actions";
import { CaseForm } from "@/features/cases/components/case-form";
import { CaseStatusControls, DeleteEventButton, DeleteTaskButton, TaskStatusSelect } from "@/features/cases/components/case-controls";
import { EventForm } from "@/features/cases/components/event-form";
import { getMembers, type CaseRow, type EventRow, type EvidenceRow, type FindingRow, type IocRow, type TaskRow } from "@/features/cases/data";
import { describeAction } from "@/lib/audit-labels";
import {
  CASE_CATEGORIES,
  CLASSIFICATIONS,
  EVENT_CATEGORIES,
  EVIDENCE_TYPES,
  IOC_TYPES,
  REPORT_TYPES,
  TASK_STATUSES,
  options,
  type Classification,
  type Confidence,
  type EventCategory,
  type InfoStatus,
  type ReportType,
} from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/format";
import { defang } from "@/lib/indicators";
import { requireActiveOrg } from "@/lib/org";
import { firstParam } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dettaglio caso" };

const TABS = [
  { key: "overview", label: "Panoramica", icon: ScanSearch },
  { key: "tasks", label: "Attività", icon: ListTodo },
  { key: "evidence", label: "Evidenze", icon: FolderLock },
  { key: "timeline", label: "Timeline", icon: CalendarClock },
  { key: "intel", label: "OSINT e IOC", icon: Radar },
  { key: "attack", label: "ATT&CK", icon: Crosshair },
  { key: "reports", label: "Report", icon: FileText },
  { key: "history", label: "Cronologia", icon: History },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function CaseDetailPage({ params, searchParams }: PageProps<"/investigations/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === firstParam(sp.tab))?.key ?? "overview") as TabKey;
  const { active, user } = await requireActiveOrg();
  const supabase = await createClient();

  const { data: caseData } = await supabase.from("cases").select("*").eq("id", id).maybeSingle();
  if (!caseData) notFound();
  const c = caseData as CaseRow;

  const members = await getMembers(c.organization_id);
  const nameOf = (uid: string | null) => members.find((m) => m.user_id === uid)?.full_name ?? (uid ? "Utente" : "—");
  const myRole = active.role;
  const isAdmin = myRole === "admin";
  const writable =
    c.status !== "archived" && (myRole === "admin" || myRole === "analyst" || (myRole === "trainee" && c.created_by === user.id));

  const [tasksRes, evidenceRes, eventsRes, findingsRes, iocRes, reportsRes, historyRes, attackRes] = await Promise.all([
    supabase.from("case_tasks").select("*").eq("case_id", id).order("created_at"),
    supabase.from("evidence").select("*").eq("case_id", id).order("collected_at", { ascending: false }),
    supabase.from("investigation_events").select("*").eq("case_id", id).order("event_at"),
    supabase.from("osint_findings").select("*").eq("case_id", id).order("collected_at", { ascending: false }),
    supabase.from("ioc_indicators").select("*").eq("case_id", id).order("created_at", { ascending: false }),
    supabase.from("reports").select("id, title, report_type, version, status, classification, updated_at").eq("case_id", id).order("updated_at", { ascending: false }),
    tab === "history"
      ? supabase.from("audit_logs").select("id, action, metadata, user_id, created_at").eq("case_id", id).order("created_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] as { id: number; action: string; metadata: unknown; user_id: string | null; created_at: string }[] }),
    supabase
      .from("case_attack_techniques")
      .select("id, technique_id, info_status, confidence, observation, evidence_id, source, attack_techniques(name, tactics, parent_id)")
      .eq("case_id", id)
      .order("technique_id"),
  ]);
  const attackMappings = (attackRes.data ?? []) as unknown as AttackMappingRow[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const evidence = (evidenceRes.data ?? []) as EvidenceRow[];
  const events = (eventsRes.data ?? []) as EventRow[];
  const findings = (findingsRes.data ?? []) as FindingRow[];
  const iocs = (iocRes.data ?? []) as IocRow[];
  const reports = reportsRes.data ?? [];
  const evidenceOptions = evidence.map((e) => [e.id, e.title] as const);

  const counts: Partial<Record<TabKey, number>> = {
    tasks: tasks.filter((t) => t.status === "todo" || t.status === "in_progress").length,
    evidence: evidence.length,
    timeline: events.length,
    intel: findings.length + iocs.length,
    reports: reports.length,
    attack: attackMappings.length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/investigations", label: "Investigations" }}
        eyebrow={
          <span className="flex items-center gap-2">
            <span className="font-mono">{c.case_ref}</span> · {CASE_CATEGORIES[c.category]}
          </span>
        }
        title={c.title}
        description={
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <CaseStatusBadge value={c.status} />
            <PriorityBadge value={c.priority} />
            <RiskBadge value={c.risk_level} />
            <DemoBadge show={c.is_demo} />
            <span className="text-xs">
              Aperto il {formatDate(c.opened_at)}
              {c.closed_at ? ` · chiuso il ${formatDate(c.closed_at)}` : ""} · Responsabile: {nameOf(c.assigned_to)}
            </span>
          </div>
        }
        actions={writable || c.status === "archived" ? <CaseStatusControls caseId={c.id} status={c.status} isAdmin={isAdmin} /> : null}
      />

      {c.status === "archived" ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Caso archiviato il {formatDateTime(c.archived_at!)}: i contenuti sono in sola lettura.
        </p>
      ) : null}

      <nav aria-label="Sezioni del caso" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/investigations/${id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              tab === t.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" aria-hidden="true" />
            {t.label}
            {counts[t.key] ? <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{counts[t.key]}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Dati del caso</CardTitle>
              <CardDescription>{writable ? "Ogni modifica viene salvata su Supabase e registrata nell'audit log." : "Sola lettura per il tuo ruolo."}</CardDescription>
            </CardHeader>
            <CardContent>
              {writable ? (
                <CaseForm action={updateCaseAction.bind(null, c.id)} members={members} initial={c} submitLabel="Salva modifiche" successMessage="Caso aggiornato" />
              ) : (
                <dl className="grid gap-3 text-sm">
                  {[
                    ["Obiettivo", c.objective],
                    ["Descrizione", c.description],
                    ["Note", c.notes],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="whitespace-pre-wrap">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sintesi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["Attività aperte", counts.tasks ?? 0],
                ["Evidenze", evidence.length],
                ["Eventi in timeline", events.length],
                ["Risultati OSINT", findings.length],
                ["IOC collegati", iocs.length],
                ["Report", reports.length],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between border-b pb-1.5 last:border-0">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium tabular-nums">{v}</span>
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                Creato da {nameOf(c.created_by)} il {formatDateTime(c.created_at)}. Ultimo aggiornamento {formatDateTime(c.updated_at)}.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Attività</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessuna attività. Aggiungi la prima con il modulo a lato.</p>
              ) : (
                <ul className="divide-y">
                  {tasks.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-medium", (t.status === "done" || t.status === "cancelled") && "text-muted-foreground line-through")}>{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.due_at ? `Scadenza ${formatDateTime(t.due_at)}` : "Nessuna scadenza"}
                          {t.description ? ` · ${t.description}` : ""}
                        </p>
                      </div>
                      {writable ? (
                        <>
                          <TaskStatusSelect caseId={id} taskId={t.id} status={t.status} />
                          <DeleteTaskButton caseId={id} taskId={t.id} />
                        </>
                      ) : (
                        <ToneBadge tone="neutral">{TASK_STATUSES[t.status]}</ToneBadge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {writable ? (
            <Card>
              <CardHeader>
                <CardTitle>Nuova attività</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={createTaskAction.bind(null, id)} successMessage="Attività aggiunta" resetOnSuccess className="grid gap-3">
                  <FormField label="Titolo" htmlFor="task-title" required>
                    <TextInput id="task-title" name="title" required />
                  </FormField>
                  <FormField label="Descrizione" htmlFor="task-description">
                    <TextInput id="task-description" name="description" />
                  </FormField>
                  <FormField label="Scadenza" htmlFor="task-due">
                    <TextInput id="task-due" name="due_at" type="datetime-local" />
                  </FormField>
                  <FormField label="Stato" htmlFor="task-status">
                    <SelectInput id="task-status" name="status" options={options.taskStatuses} defaultValue="todo" />
                  </FormField>
                  <SubmitButton size="sm">
                    <Plus /> Aggiungi
                  </SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "evidence" ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Evidenze del caso</CardTitle>
              <CardDescription>File privati con hash SHA-256 calcolato al caricamento.</CardDescription>
            </div>
            {writable ? (
              <Button asChild size="sm">
                <Link href={`/evidence/new?case=${id}`}>
                  <FilePlus2 /> Aggiungi evidenza
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna evidenza collegata.</p>
            ) : (
              <ul className="divide-y">
                {evidence.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/evidence/${e.id}`} className="text-sm font-medium hover:underline">
                        {e.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {EVIDENCE_TYPES[e.evidence_type]} · acquisita il {formatDateTime(e.collected_at)}
                        {e.sha256_hash ? <span className="ml-1 font-mono">· {e.sha256_hash.slice(0, 16)}…</span> : " · nessun file"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <ReliabilityBadge value={e.reliability} />
                      <InfoStatusBadge value={e.verification_status} />
                      <DemoBadge show={e.is_demo} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "timeline" ? (
        <TimelineTab caseId={id} events={events} evidenceOptions={evidenceOptions} writable={writable} category={firstParam(sp.ecat)} />
      ) : null}

      {tab === "intel" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <CardTitle>Risultati OSINT</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href={`/osint?case=${id}`}>Apri OSINT Workspace</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {findings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun risultato collegato.</p>
              ) : (
                <ul className="divide-y">
                  {findings.map((f) => (
                    <li key={f.id} className="space-y-1 py-2.5">
                      <p className="text-sm font-medium">{f.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{f.data}</p>
                      <div className="flex flex-wrap gap-1">
                        <InfoStatusBadge value={f.info_status} />
                        <ReliabilityBadge value={f.reliability} />
                        <DemoBadge show={f.is_demo} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <CardTitle>Indicatori (IOC)</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href={`/threat-intel?case=${id}`}>Apri Threat Intelligence</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {iocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun indicatore collegato.</p>
              ) : (
                <ul className="divide-y">
                  {iocs.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs">{defang(i.indicator_value)}</p>
                        <p className="text-[11px] text-muted-foreground">{IOC_TYPES[i.indicator_type as keyof typeof IOC_TYPES]}</p>
                      </div>
                      <VerdictBadge value={i.analyst_verdict} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "attack" ? (
        <AttackTab caseId={id} mappings={attackMappings} writable={writable} evidenceOptions={evidenceOptions} />
      ) : null}

      {tab === "reports" ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <CardTitle>Report del caso</CardTitle>
            {writable ? (
              <Button asChild size="sm">
                <Link href={`/reports/new?case=${id}`}>
                  <FilePlus2 /> Nuovo report
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun report.</p>
            ) : (
              <ul className="divide-y">
                {reports.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <Link href={`/reports/${r.id}`} className="text-sm font-medium hover:underline">
                        {r.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {REPORT_TYPES[r.report_type as ReportType]} · v{r.version} · {CLASSIFICATIONS[r.classification as Classification]}
                      </p>
                    </div>
                    <ToneBadge tone={r.status === "final" ? "success" : "info"}>{r.status === "final" ? "Finale" : "Bozza"}</ToneBadge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "history" ? (
        <Card>
          <CardHeader>
            <CardTitle>Cronologia degli aggiornamenti</CardTitle>
            <CardDescription>Dall&apos;audit log immutabile dell&apos;organizzazione.</CardDescription>
          </CardHeader>
          <CardContent>
            {(historyRes.data ?? []).length === 0 ? (
              <EmptyState icon={History} title="Nessuna voce visibile" />
            ) : (
              <ol className="relative space-y-3 border-l pl-4">
                {historyRes.data!.map((h) => {
                  const meta = (h.metadata ?? {}) as { title?: string; changed?: string[]; status?: string; previous_status?: string };
                  return (
                    <li key={h.id} className="text-sm">
                      <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-primary" aria-hidden="true" />
                      <p className="font-medium">
                        {describeAction(h.action)}
                        {meta.title ? <span className="font-normal text-muted-foreground"> — {meta.title}</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(h.created_at)} · {nameOf(h.user_id)}
                        {meta.previous_status ? ` · stato: ${meta.previous_status} → ${meta.status}` : ""}
                        {meta.changed?.length ? ` · campi: ${meta.changed.join(", ")}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function TimelineTab({
  caseId,
  events,
  evidenceOptions,
  writable,
  category,
}: {
  caseId: string;
  events: EventRow[];
  evidenceOptions: (readonly [string, string])[];
  writable: boolean;
  category?: string;
}) {
  const filtered = category ? events.filter((e) => e.category === category) : events;
  return (
    <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader className="gap-3">
          <CardTitle>Timeline investigativa</CardTitle>
          <CardDescription>Ordine cronologico per data dell&apos;evento; la data di acquisizione indica quando l&apos;analista ne è venuto a conoscenza.</CardDescription>
          <div className="flex flex-wrap gap-1">
            <Link
              href={`/investigations/${caseId}?tab=timeline`}
              className={cn("rounded-full border px-2.5 py-0.5 text-xs", !category ? "border-primary bg-primary/10" : "hover:bg-muted")}
            >
              Tutte
            </Link>
            {Object.entries(EVENT_CATEGORIES).map(([k, l]) => (
              <Link
                key={k}
                href={`/investigations/${caseId}?tab=timeline&ecat=${k}`}
                className={cn("rounded-full border px-2.5 py-0.5 text-xs", category === k ? "border-primary bg-primary/10" : "hover:bg-muted")}
              >
                {l}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun evento.</p>
          ) : (
            <ol className="relative space-y-5 border-l pl-5">
              {filtered.map((e) => (
                <li key={e.id}>
                  <span className="absolute -left-1.5 mt-1 size-3 rounded-full border-2 border-background bg-teal" aria-hidden="true" />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <time className="text-xs font-medium text-teal" dateTime={e.event_at}>
                        {formatDateTime(e.event_at)}
                      </time>
                      <p className="text-sm font-medium">{e.title}</p>
                    </div>
                    {writable ? <DeleteEventButton caseId={caseId} eventId={e.id} /> : null}
                  </div>
                  {e.description ? <p className="mt-0.5 text-sm text-muted-foreground">{e.description}</p> : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <ToneBadge tone="neutral">{EVENT_CATEGORIES[e.category as EventCategory]}</ToneBadge>
                    <InfoStatusBadge value={e.info_status} />
                    <ReliabilityBadge value={e.reliability} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Fonte: {e.source ?? "—"} · acquisito il {formatDateTime(e.recorded_at)}
                    {e.evidence_id ? (
                      <>
                        {" · "}
                        <Link href={`/evidence/${e.evidence_id}`} className="underline">
                          evidenza collegata
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {writable ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-primary">Modifica evento</summary>
                      <div className="mt-2 rounded-lg border p-3">
                        <EventForm
                          action={updateEventAction.bind(null, caseId, e.id)}
                          evidenceOptions={evidenceOptions}
                          initial={e}
                          submitLabel="Salva evento"
                          idPrefix={`ev-${e.id.slice(0, 8)}`}
                        />
                      </div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      {writable ? (
        <Card>
          <CardHeader>
            <CardTitle>Nuovo evento</CardTitle>
          </CardHeader>
          <CardContent>
            <EventForm action={createEventAction.bind(null, caseId)} evidenceOptions={evidenceOptions} submitLabel="Aggiungi alla timeline" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

type AttackMappingRow = {
  id: string;
  technique_id: string;
  info_status: InfoStatus;
  confidence: Confidence;
  observation: string | null;
  evidence_id: string | null;
  source: string | null;
  attack_techniques: { name: string; tactics: string[]; parent_id: string | null } | null;
};

async function AttackTab({
  caseId,
  mappings,
  writable,
  evidenceOptions,
}: {
  caseId: string;
  mappings: AttackMappingRow[];
  writable: boolean;
  evidenceOptions: (readonly [string, string])[];
}) {
  const [tactics, index] = await Promise.all([getTactics(), writable ? getTechniqueIndex() : Promise.resolve([])]);
  return (
    <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Tecniche MITRE ATT&amp;CK del caso</CardTitle>
          <CardDescription>
            Ordinate lungo le fasi dell&apos;attacco. Una tecnica è un fatto solo se un&apos;evidenza la supporta; altrimenti resta un&apos;ipotesi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna tecnica mappata. Usa il modulo a lato, le pagine di <Link href="/attack" className="underline">MITRE ATT&amp;CK</Link> o i
              suggerimenti del Phishing Lab.
            </p>
          ) : (
            <ol className="space-y-4">
              {tactics.map((tac) => {
                const list = mappings.filter((m) => m.attack_techniques?.tactics.includes(tac.shortname));
                if (!list.length) return null;
                return (
                  <li key={tac.id}>
                    <p className="mb-1.5 text-xs font-semibold tracking-wide text-teal uppercase">
                      {TACTIC_GUIDE[tac.shortname]?.title ?? tac.name} · {tac.name}
                    </p>
                    <ul className="space-y-2">
                      {list.map((m) => (
                        <li key={`${tac.id}-${m.id}`} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <Link href={`/attack/${m.technique_id}`} className="text-sm font-medium hover:underline">
                              <span className="font-mono text-xs text-muted-foreground">{m.technique_id}</span> {m.attack_techniques?.name}
                            </Link>
                            {writable ? <DeleteMappingButton mappingId={m.id} caseId={caseId} /> : null}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <InfoStatusBadge value={m.info_status} />
                            <ToneBadge tone={m.confidence === "high" ? "success" : m.confidence === "moderate" ? "info" : "neutral"}>
                              Confidenza {m.confidence === "high" ? "alta" : m.confidence === "moderate" ? "moderata" : "bassa"}
                            </ToneBadge>
                            {m.source && m.source !== "manual" ? <ToneBadge tone="neutral">da {m.source.replace("_", " ")}</ToneBadge> : null}
                          </div>
                          {m.observation ? <p className="mt-1 text-xs text-muted-foreground">{m.observation}</p> : null}
                          {writable ? (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-primary">Aggiorna valutazione</summary>
                              <ActionForm action={updateMappingAction.bind(null, m.id, caseId)} successMessage="Valutazione aggiornata" className="mt-2 grid gap-2 sm:grid-cols-2">
                                <SelectInput id={`ms-${m.id}-${tac.id}`} name="info_status" options={options.infoStatuses} defaultValue={m.info_status} />
                                <SelectInput id={`mc-${m.id}-${tac.id}`} name="confidence" options={options.confidence} defaultValue={m.confidence} />
                                <SelectInput id={`me-${m.id}-${tac.id}`} name="evidence_id" options={evidenceOptions} defaultValue={m.evidence_id} placeholder="— Nessuna evidenza —" className="sm:col-span-2" />
                                <TextInput id={`mo-${m.id}-${tac.id}`} name="observation" defaultValue={m.observation ?? ""} placeholder="Osservazione" className="sm:col-span-2" />
                                <SubmitButton size="sm" variant="outline">
                                  Salva
                                </SubmitButton>
                              </ActionForm>
                            </details>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
      {writable ? (
        <Card>
          <CardHeader>
            <CardTitle>Mappa una tecnica</CardTitle>
          </CardHeader>
          <CardContent>
            <MapTechniqueForm caseId={caseId} techniqueOptions={techniqueOptions(index)} evidenceOptions={evidenceOptions} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
