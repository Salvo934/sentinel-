import { BookOpenCheck, CheckCircle2, Clock, FileText, Lightbulb, MailWarning, Target, Wrench, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ToneBadge } from "@/components/common/tone-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { selectClass } from "@/components/forms/fields";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { saveAttemptAction } from "@/features/training/actions";
import { DiscardAttemptButton, StartAttemptButton } from "@/features/training/components/attempt-buttons";
import { DIFFICULTY, RUBRIC_SCALE, rubricPercent, type Attempt, type Scenario, type Solution } from "@/features/training/types";
import { CASE_CATEGORIES, type CaseCategory } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Esercitazione" };

export default async function TrainingScenarioPage({ params }: PageProps<"/training/[slug]">) {
  const { slug } = await params;
  const { user } = await requireActiveOrg();
  const supabase = await createClient();
  const { data } = await supabase.from("training_scenarios").select("*").eq("slug", slug).maybeSingle();
  if (!data) notFound();
  const sc = data as Scenario;
  const c = sc.content;

  const { data: attemptsData } = await supabase
    .from("training_attempts")
    .select("*")
    .eq("scenario_id", sc.id)
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });
  const attempts = (attemptsData ?? []) as Attempt[];
  const open = attempts.find((a) => a.status === "in_progress") ?? null;
  const lastSubmitted = attempts.find((a) => a.status === "submitted") ?? null;
  let solution: Solution | null = null;
  if (lastSubmitted) {
    const { data: sol } = await supabase.rpc("get_training_solution", { p_scenario: sc.id });
    solution = (sol as Solution) ?? null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/training", label: "Training Academy" }}
        eyebrow={`${CASE_CATEGORIES[sc.category as CaseCategory]} · ${DIFFICULTY[sc.difficulty]}`}
        title={sc.title}
        description={
          <div className="space-y-2">
            <p>{sc.description}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <ToneBadge tone="neutral">
                <Clock className="size-3" /> {sc.estimated_minutes} minuti indicativi
              </ToneBadge>
              {sc.skills.map((s) => (
                <ToneBadge key={s} tone="teal">
                  {s}
                </ToneBadge>
              ))}
            </div>
          </div>
        }
        actions={!open ? <StartAttemptButton scenarioId={sc.id} slug={slug} again={Boolean(lastSubmitted)} /> : null}
      />

      <FormAlert tone="info">
        Scenario interamente fittizio. Il punteggio è un indicatore formativo personale e non rappresenta una certificazione professionale.
      </FormAlert>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scenario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>{c.scenario}</p>
              <blockquote className="rounded-lg border-l-4 border-teal bg-teal/5 px-4 py-3">
                <p className="text-xs font-semibold text-teal">Briefing — {c.briefing.from}</p>
                <p className="mt-1">{c.briefing.text}</p>
              </blockquote>
              <div className="flex items-start gap-2">
                <Target className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <p>
                  <strong>Obiettivo:</strong> {c.objective}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" aria-hidden="true" /> Documenti e dataset disponibili
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {c.documents.map((d) => (
                <details key={d.id} className="rounded-lg border" open={c.documents.length <= 2}>
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                    {d.title} <span className="font-normal text-muted-foreground">· {d.source}</span>
                  </summary>
                  <pre className="overflow-x-auto border-t bg-muted/40 px-3 py-2 font-mono text-xs whitespace-pre-wrap">{d.body}</pre>
                </details>
              ))}
              {c.sample_key ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/phishing?sample=${c.sample_key}`}>
                    <MailWarning /> Apri il messaggio nel Phishing Lab
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {open ? (
            <Card className="ring-primary/40">
              <CardHeader>
                <CardTitle>Il tuo lavoro</CardTitle>
                <CardDescription>Iniziato il {formatDateTime(open.started_at)}. Puoi salvare e riprendere in qualsiasi momento.</CardDescription>
              </CardHeader>
              <CardContent>
                <ActionForm action={saveAttemptAction.bind(null, open.id, slug)} successMessage="Salvato" className="space-y-6">
                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold">Domande di verifica</h3>
                    {c.questions.map((q, i) => (
                      <fieldset key={q.id} className="space-y-2 rounded-lg border p-3">
                        <legend className="px-1 text-sm font-medium">
                          {i + 1}. {q.prompt}
                        </legend>
                        {q.type === "keywords" ? (
                          <Textarea name={`q_${q.id}`} rows={4} defaultValue={(open.answers[q.id] as string) ?? ""} placeholder={q.placeholder} />
                        ) : (
                          q.options.map((o) => {
                            const prev = open.answers[q.id];
                            const checked = Array.isArray(prev) ? prev.includes(o.value) : prev === o.value;
                            return (
                              <label key={o.value} className="flex items-start gap-2 text-sm">
                                <input
                                  type={q.type === "multi" ? "checkbox" : "radio"}
                                  name={`q_${q.id}`}
                                  value={o.value}
                                  defaultChecked={checked}
                                  className="mt-1 size-4 shrink-0"
                                />
                                {o.label}
                              </label>
                            );
                          })
                        )}
                        {q.type === "multi" ? <p className="text-xs text-muted-foreground">Più risposte possibili: le scelte errate riducono il punteggio.</p> : null}
                      </fieldset>
                    ))}
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Consegna dell&apos;analista — {c.deliverable.title}</h3>
                    <p className="text-xs text-muted-foreground">Sezioni attese: {c.deliverable.sections.join(" · ")}</p>
                    <Textarea name="submitted_content" rows={14} defaultValue={open.submitted_content ?? ""} placeholder="Scrivi qui il tuo elaborato (minimo 50 caratteri per la consegna)…" />
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Autovalutazione con la griglia</h3>
                    <div className="space-y-2">
                      {sc.grading_rubric.map((r) => (
                        <div key={r.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_220px] sm:items-center">
                          <div>
                            <p className="text-sm font-medium">
                              {r.criterion} <span className="text-xs font-normal text-muted-foreground">(peso {r.weight}%)</span>
                            </p>
                            <p className="text-xs text-muted-foreground">{r.description}</p>
                          </div>
                          <select name={`rubric_${r.id}`} defaultValue={open.self_assessment[r.id]?.toString() ?? ""} className={selectClass} aria-label={`Autovalutazione: ${r.criterion}`}>
                            <option value="">Non valutato</option>
                            {RUBRIC_SCALE.map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                    <SubmitButton variant="outline" name="intent" value="save">
                      Salva bozza
                    </SubmitButton>
                    <SubmitButton name="intent" value="submit">
                      Consegna e ricevi il feedback
                    </SubmitButton>
                    <DiscardAttemptButton attemptId={open.id} slug={slug} />
                  </div>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}

          {lastSubmitted ? <Feedback scenario={sc} attempt={lastSubmitted} solution={solution} /> : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenCheck className="size-4" aria-hidden="true" /> Attività richieste
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {c.tasks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="size-4" aria-hidden="true" /> Istruzioni
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {c.instructions.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="size-4" aria-hidden="true" /> Strumenti consigliati
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {c.tools.map((t) => (
                <ToneBadge key={t} tone="info">
                  {t}
                </ToneBadge>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Griglia di valutazione</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {sc.grading_rubric.map((r) => (
                  <li key={r.id}>
                    <p className="font-medium">
                      {r.criterion} <span className="text-xs text-muted-foreground">({r.weight}%)</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {attempts.filter((a) => a.status === "submitted").length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Storico tentativi</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {attempts
                    .filter((a) => a.status === "submitted")
                    .map((a) => (
                      <li key={a.id} className="flex justify-between">
                        <span>{formatDateTime(a.completed_at!)}</span>
                        <span className="tabular-nums">
                          {Number(a.score)}/{Number(a.max_score)}
                        </span>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Feedback({ scenario, attempt, solution }: { scenario: Scenario; attempt: Attempt; solution: Solution | null }) {
  const pct = attempt.max_score ? Math.round((Number(attempt.score) / Number(attempt.max_score)) * 100) : 0;
  const rubricPct = rubricPercent(scenario.grading_rubric, attempt.self_assessment);
  const list = (title: string, items?: string[]) =>
    items?.length ? (
      <div>
        <p className="mb-1 text-sm font-semibold">{title}</p>
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feedback finale e soluzione guidata</CardTitle>
        <CardDescription>Ultima consegna: {formatDateTime(attempt.completed_at!)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Domande a correzione automatica</p>
            <p className="text-2xl font-semibold tabular-nums">
              {Number(attempt.score)} / {Number(attempt.max_score)} <span className="text-base text-muted-foreground">({pct}%)</span>
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Autovalutazione dell&apos;elaborato (griglia)</p>
            <p className="text-2xl font-semibold tabular-nums">{rubricPct !== null ? `${rubricPct}%` : "—"}</p>
          </div>
        </div>
        <ul className="space-y-2">
          {scenario.content.questions.map((q, i) => {
            const f = attempt.feedback?.[q.id];
            const answer = attempt.answers[q.id];
            return (
              <li key={q.id} className="rounded-lg border p-3 text-sm">
                <p className="flex items-start gap-2 font-medium">
                  {f?.correct ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />}
                  {i + 1}. {q.prompt}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  La tua risposta: {Array.isArray(answer) ? answer.join(", ") || "—" : answer ? String(answer).slice(0, 300) : "—"} · Punti {f?.earned ?? 0}/{f?.points ?? "?"}
                </p>
                {f?.explanation ? <p className="mt-1 text-xs">{f.explanation}</p> : null}
              </li>
            );
          })}
        </ul>
        {solution ? (
          <div className="space-y-3 rounded-lg border border-teal/30 bg-teal/5 p-4">
            <p className="text-sm font-semibold text-teal">Soluzione guidata</p>
            <p className="text-sm">{solution.summary}</p>
            {list("Elementi chiave", solution.key_findings)}
            {list("Cronologia", solution.timeline)}
            {list("Indicatori", solution.indicators)}
            {list("Raccomandazioni", solution.recommendations)}
            {list("Errori comuni da evitare", solution.common_mistakes)}
          </div>
        ) : null}
        <details>
          <summary className="cursor-pointer text-sm text-primary">La tua consegna</summary>
          <pre className="mt-2 rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap">{attempt.submitted_content}</pre>
        </details>
      </CardContent>
    </Card>
  );
}
