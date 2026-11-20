import { AlertTriangle, BookMarked, ExternalLink, FileText, GraduationCap, Inbox, Mail, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ToneBadge } from "@/components/common/tone-badge";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AbandonMissionButton,
  CompleteMissionButton,
  LinkCaseForm,
  StartMissionButton,
} from "@/features/missions/components/mission-controls";
import { StepCard } from "@/features/missions/components/step-card";
import { missionScore, type Debrief, type Mission, type MissionRun, type StepNote } from "@/features/missions/types";
import { CASE_CATEGORIES, type CaseCategory } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Missione" };

export default async function MissionPage({ params }: PageProps<"/missions/[slug]">) {
  const { slug } = await params;
  const { user, active } = await requireActiveOrg();
  const supabase = await createClient();
  const { data } = await supabase.from("missions").select("*").eq("slug", slug).maybeSingle();
  if (!data) notFound();
  const mission = data as Mission;
  const c = mission.content;

  const { data: runData } = await supabase
    .from("mission_runs")
    .select("*")
    .eq("mission_id", mission.id)
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });
  const runs = (runData ?? []) as MissionRun[];
  const open = runs.find((r) => r.status === "in_progress") ?? null;
  const lastCompleted = runs.find((r) => r.status === "completed") ?? null;
  const current = open ?? lastCompleted;

  const [notesRes, casesRes, linkedCaseRes, debriefRes] = await Promise.all([
    current ? supabase.rpc("get_mission_notes", { p_run: current.id }) : Promise.resolve({ data: {} }),
    open && !open.case_id
      ? supabase
          .from("cases")
          .select("id, case_ref, title")
          .eq("organization_id", active.organizationId)
          .eq("category", mission.category)
          .neq("status", "archived")
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as { id: string; case_ref: string; title: string }[] }),
    current?.case_id ? supabase.from("cases").select("id, case_ref, title").eq("id", current.case_id).maybeSingle() : Promise.resolve({ data: null }),
    !open && lastCompleted ? supabase.rpc("complete_mission", { p_run: lastCompleted.id }) : Promise.resolve({ data: null }),
  ]);
  const notes = (notesRes.data ?? {}) as Record<string, StepNote>;
  const debrief = debriefRes.data as Debrief | null;
  const caseOptions = (casesRes.data ?? []).map((x) => [x.id as string, `${x.case_ref} · ${x.title}`] as const);
  const linkedCase = linkedCaseRes.data as { id: string; case_ref: string; title: string } | null;
  const firstOpenIndex = open ? c.steps.findIndex((s) => !open.steps[s.id]?.done) : -1;
  const allDone = open ? firstOpenIndex === -1 : false;
  const score = lastCompleted ? missionScore(mission, lastCompleted) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: mission.kind === "real_case" ? "/missions?tab=real" : "/missions", label: mission.kind === "real_case" ? "Casi reali" : "Missioni guidate" }}
        eyebrow={`${mission.kind === "real_case" ? "Caso reale" : "Missione guidata"} · ${CASE_CATEGORIES[mission.category as CaseCategory]} · ${mission.estimated_minutes} min`}
        title={mission.title}
        description={mission.summary}
        actions={!open ? <StartMissionButton missionId={mission.id} slug={slug} again={Boolean(lastCompleted)} /> : <AbandonMissionButton runId={open.id} slug={slug} />}
      />

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="size-4" aria-hidden="true" /> La richiesta
              </CardTitle>
              <CardDescription>
                {c.request.from} · {c.request.channel}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <blockquote className="rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm">“{c.request.text}”</blockquote>
              <p className="text-sm text-muted-foreground">{c.context}</p>
            </CardContent>
          </Card>

          {open ? (
            <Card>
              <CardHeader>
                <CardTitle>Il caso su cui lavori</CardTitle>
                <CardDescription>Le verifiche automatiche controllano il lavoro fatto su questo caso.</CardDescription>
              </CardHeader>
              <CardContent>
                {linkedCase ? (
                  <Link href={`/investigations/${linkedCase.id}`} className="text-sm font-medium hover:underline">
                    {linkedCase.case_ref} · {linkedCase.title}
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Crea il caso con il pulsante del passo 1 (tipologia: {CASE_CATEGORIES[mission.category as CaseCategory]}), poi collegalo qui.
                    </p>
                    <LinkCaseForm runId={open.id} slug={slug} cases={caseOptions} />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {current ? (
            <ol className="space-y-3">
              {c.steps.map((step, i) => (
                <StepCard
                  key={`${current.id}-${step.id}`}
                  index={i}
                  step={step}
                  runId={current.id}
                  slug={slug}
                  caseId={current.case_id}
                  state={current.steps[step.id]}
                  note={notes[step.id]}
                  active={open ? i === firstOpenIndex : false}
                  locked={!open}
                />
              ))}
            </ol>
          ) : (
            <Card>
              <CardContent className="space-y-2 py-6 text-center">
                <p className="text-sm">
                  {c.steps.length} passi da svolgere nei moduli della piattaforma. Premi <strong>Inizia la missione</strong> per cominciare.
                </p>
                <ol className="mx-auto max-w-md list-decimal space-y-0.5 pl-5 text-left text-sm text-muted-foreground">
                  {c.steps.map((s) => (
                    <li key={s.id}>{s.title}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {open && allDone ? (
            <Card className="ring-success/40">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <p className="text-sm font-medium">Hai completato tutti i passi.</p>
                <CompleteMissionButton runId={open.id} slug={slug} />
              </CardContent>
            </Card>
          ) : null}

          {!open && lastCompleted && debrief ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="size-4" aria-hidden="true" /> Debriefing
                </CardTitle>
                <CardDescription>
                  Completata il {formatDateTime(lastCompleted.completed_at!)}
                  {score?.graded ? ` · verifiche corrette al primo tentativo: ${score.correct}/${score.graded}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{debrief.summary}</p>
                <div>
                  <p className="mb-1 font-semibold">Lezioni da portare con te</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {debrief.lessons.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-semibold">Prossimi passi</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {debrief.next.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">Le verifiche sono un supporto formativo, non una certificazione.</p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {c.dossier ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookMarked className="size-4" aria-hidden="true" /> Dossier del fenomeno
                </CardTitle>
                <CardDescription>Cosa sappiamo da fonti pubbliche (i numeri rimandano alle fonti).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p>{c.dossier.phenomenon}</p>
                <div>
                  <p className="mb-1 font-semibold">I dati</p>
                  <ul className="space-y-1">
                    {c.dossier.figures.map((f) => (
                      <li key={f.text} className="text-sm">
                        {f.text}{" "}
                        <a href={`#fonte-${f.source}`} className="text-xs text-primary">
                          [{f.source}]
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-semibold">Come funziona l&apos;attacco</p>
                  <ol className="space-y-1">
                    {c.dossier.how_it_works.map((h, i) => (
                      <li key={h.step} className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] tabular-nums">{i + 1}</span>
                        <span>
                          {h.step}
                          {h.technique ? (
                            <>
                              {" "}
                              <Link href={`/attack/${h.technique}`} className="font-mono text-xs text-primary hover:underline">
                                {h.technique}
                              </Link>
                            </>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="size-4 text-warning" aria-hidden="true" /> Segnali di allarme
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {c.dossier.red_flags.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-semibold">Impatto</p>
                  <p>{c.dossier.impact}</p>
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1 font-semibold">
                    <ShieldCheck className="size-4 text-success" aria-hidden="true" /> Difese
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {c.dossier.defenses.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Materiali</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {c.materials.map((m, i) =>
                m.type === "sample" ? (
                  <Button key={i} asChild variant="outline" size="sm" className="w-full justify-start">
                    <Link href={`/phishing?sample=${m.sample_key}`}>
                      <Mail /> {m.label}
                    </Link>
                  </Button>
                ) : m.type === "link" ? (
                  <Button key={i} asChild variant="outline" size="sm" className="h-auto w-full justify-start py-1.5 whitespace-normal">
                    <a href={m.href} target={m.external ? "_blank" : undefined} rel={m.external ? "noopener noreferrer" : undefined}>
                      {m.external ? <ExternalLink /> : <FileText />} {m.label}
                    </a>
                  </Button>
                ) : (
                  <details key={i} className="rounded-lg border" open>
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{m.title}</summary>
                    <pre className="overflow-x-auto border-t bg-muted/40 px-3 py-2 font-mono text-[11px] whitespace-pre-wrap">{m.body}</pre>
                  </details>
                ),
              )}
            </CardContent>
          </Card>

          {c.sources.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Fonti</CardTitle>
                <CardDescription>Aprile in una nuova scheda per leggere l&apos;originale e verificare i dati.</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {c.sources.map((s, i) => (
                    <li key={s.url} id={`fonte-${i + 1}`} className="flex gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">[{i + 1}]</span>
                      <span>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                          {s.title}
                        </a>
                        <span className="block text-xs text-muted-foreground">
                          {s.publisher} · {s.date}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ) : null}

          {mission.kind === "real_case" ? (
            <FormAlert tone="info">
              Esercitati con la fonte originale: dopo la missione, apri la sintesi più recente del CERT-AGID e cerca campagne simili. È così che si
              tiene aggiornato un analista.
            </FormAlert>
          ) : null}

          <div className="flex flex-wrap gap-1">
            {mission.roles.map((r) => (
              <ToneBadge key={r} tone="teal">
                {r}
              </ToneBadge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
