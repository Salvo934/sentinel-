import { Clock, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ToneBadge } from "@/components/common/tone-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PortfolioButton, type PortfolioEntry } from "@/features/training/components/portfolio-button";
import { DIFFICULTY, rubricPercent, type Attempt, type Scenario } from "@/features/training/types";
import { formatDateTime } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Training Academy" };

const PLANNED = [
  { title: "Cyber Threat Intelligence — Intelligence Brief", note: "Fase 4" },
  { title: "Corporate Risk Assessment", note: "Fase 4" },
];

export default async function TrainingPage() {
  const { user, fullName } = await requireActiveOrg();
  const supabase = await createClient();
  const [{ data: scData }, { data: atData }] = await Promise.all([
    supabase.from("training_scenarios").select("*").order("sort_order"),
    supabase.from("training_attempts").select("*").eq("user_id", user.id).order("started_at", { ascending: false }),
  ]);
  const scenarios = (scData ?? []) as Scenario[];
  const attempts = (atData ?? []) as Attempt[];
  const submitted = attempts.filter((a) => a.status === "submitted");
  const completedIds = new Set(submitted.map((a) => a.scenario_id));
  const skills = new Map<string, number>();
  for (const sc of scenarios.filter((s) => completedIds.has(s.id))) sc.skills.forEach((s) => skills.set(s, (skills.get(s) ?? 0) + 1));

  // Best attempt per scenario for the portfolio.
  const portfolio: PortfolioEntry[] = scenarios
    .map((sc) => {
      const best = submitted
        .filter((a) => a.scenario_id === sc.id)
        .sort((a, b) => Number(b.score) / Number(b.max_score) - Number(a.score) / Number(a.max_score))[0];
      return best
        ? {
            title: sc.title,
            skills: sc.skills,
            completedAt: best.completed_at!,
            score: Number(best.score),
            maxScore: Number(best.max_score),
            rubric: rubricPercent(sc.grading_rubric, best.self_assessment),
            deliverable: best.submitted_content ?? "",
          }
        : null;
    })
    .filter((x): x is PortfolioEntry => x !== null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training Academy"
        description="Esercitazioni pratiche su scenari fittizi realistici, con griglia di valutazione, feedback e soluzione guidata dopo la consegna."
        actions={<PortfolioButton analyst={fullName ?? user.email} entries={portfolio} />}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Esercitazioni completate</p>
            <p className="text-2xl font-semibold tabular-nums">
              {completedIds.size}/{scenarios.length}
            </p>
            <Progress value={scenarios.length ? (completedIds.size / scenarios.length) * 100 : 0} className="mt-2" />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Tentativi consegnati</p>
            <p className="text-2xl font-semibold tabular-nums">{submitted.length}</p>
            <p className="text-xs text-muted-foreground">In corso: {attempts.length - submitted.length}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Competenze esercitate</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {skills.size === 0 ? <span className="text-sm text-muted-foreground">—</span> : [...skills.keys()].map((s) => <ToneBadge key={s} tone="teal">{s}</ToneBadge>)}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((sc, index) => {
          const mine = attempts.filter((a) => a.scenario_id === sc.id);
          const done = mine.filter((a) => a.status === "submitted");
          const best = done.length ? Math.max(...done.map((a) => Math.round((Number(a.score) / Number(a.max_score)) * 100))) : null;
          const inProgress = mine.some((a) => a.status === "in_progress");
          return (
            <Card key={sc.id} className="transition-colors hover:ring-primary/40">
              <CardHeader>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">Caso {index + 1}</span> · {DIFFICULTY[sc.difficulty]}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" /> {sc.estimated_minutes} min
                  </span>
                </div>
                <CardTitle className="leading-snug">
                  <Link href={`/training/${sc.slug}`} className="hover:underline">
                    {sc.title}
                  </Link>
                </CardTitle>
                <CardDescription>{sc.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-1.5">
                {best !== null ? <ToneBadge tone="success">Completata · migliore {best}%</ToneBadge> : null}
                {inProgress ? <ToneBadge tone="info">In corso</ToneBadge> : null}
                {best === null && !inProgress ? <ToneBadge tone="neutral">Da iniziare</ToneBadge> : null}
              </CardContent>
            </Card>
          );
        })}
        {PLANNED.map((p) => (
          <Card key={p.title} className="opacity-60">
            <CardHeader>
              <div className="text-xs text-muted-foreground">Pianificata · {p.note}</div>
              <CardTitle className="leading-snug">{p.title}</CardTitle>
              <CardDescription>Esercitazione prevista nella roadmap, non ancora disponibile.</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-4" aria-hidden="true" /> Progressi nel tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submitted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna consegna ancora.</p>
          ) : (
            <ul className="divide-y text-sm">
              {submitted.map((a) => {
                const sc = scenarios.find((s) => s.id === a.scenario_id);
                const wrong = Object.values(a.feedback ?? {}).filter((f) => !f.correct).length;
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/training/${sc?.slug}`} className="hover:underline">
                      {sc?.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(a.completed_at!)} · {Number(a.score)}/{Number(a.max_score)} · {wrong} risposte da rivedere
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">I punteggi sono indicatori formativi personali e non certificazioni professionali riconosciute.</p>
        </CardContent>
      </Card>
    </div>
  );
}
