import { BookOpenCheck, Clock, Compass, Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ToneBadge } from "@/components/common/tone-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { missionScore, type Mission, type MissionRun } from "@/features/missions/types";
import { CASE_CATEGORIES, type CaseCategory } from "@/lib/domain";
import { requireActiveOrg } from "@/lib/org";
import { firstParam } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Missioni e casi reali" };

const DIFFICULTY = { beginner: "Base", intermediate: "Intermedio", advanced: "Avanzato" } as const;

const METHOD = [
  { title: "1. Ricevi una richiesta", text: "Come in azienda: qualcuno ti chiede qualcosa e deve prendere una decisione." },
  { title: "2. Lavori nei moduli veri", text: "Apri il caso, raccogli evidenze, analizzi. La piattaforma verifica che tu l'abbia fatto davvero." },
  { title: "3. Ti fai le domande giuste", text: "A ogni passo trovi le domande che si fa un analista esperto e una domanda di verifica." },
  { title: "4. Confronti con il senior", text: "Dopo ogni passo vedi come avrebbe lavorato un senior; alla fine il debriefing con le lezioni." },
];

export default async function MissionsPage({ searchParams }: PageProps<"/missions">) {
  const { user } = await requireActiveOrg();
  const tab = firstParam((await searchParams).tab) === "real" ? "real_case" : "guided";
  const supabase = await createClient();
  const [{ data: mData }, { data: rData }] = await Promise.all([
    supabase.from("missions").select("*").order("sort_order"),
    supabase.from("mission_runs").select("*").eq("user_id", user.id).order("started_at", { ascending: false }),
  ]);
  const missions = (mData ?? []) as Mission[];
  const runs = (rData ?? []) as MissionRun[];
  const visible = missions.filter((m) => m.kind === tab);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Missioni e casi reali"
        description="Impara il mestiere facendo: richieste realistiche da lavorare passo per passo nei moduli della piattaforma, con le domande di un analista esperto e il confronto con il suo lavoro."
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {METHOD.map((m) => (
          <Card key={m.title} size="sm">
            <CardContent className="space-y-1">
              <p className="text-sm font-semibold">{m.title}</p>
              <p className="text-xs text-muted-foreground">{m.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <nav aria-label="Tipologia" className="flex gap-1 border-b">
        {[
          { key: "guided", href: "/missions", label: "Missioni guidate", icon: Compass, hint: "scenari fittizi, metodo completo" },
          { key: "real_case", href: "/missions?tab=real", label: "Casi reali", icon: Newspaper, hint: "fenomeni documentati in Italia" },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
              tab === t.key ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" aria-hidden="true" /> {t.label}
            <span className="hidden text-xs font-normal text-muted-foreground sm:inline">· {t.hint}</span>
          </Link>
        ))}
      </nav>

      {tab === "real_case" ? (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Ogni caso reale si basa su fonti pubbliche (CERT-AGID, ACN, INPS, vendor e stampa specializzata, indicate come fonti secondarie quando
          lo sono) aggiornate a novembre 2026. I messaggi, i log, i domini e gli IP da analizzare sono ricostruzioni didattiche fittizie: non si
          lavora mai su infrastrutture reali degli attaccanti.
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((m) => {
          const mine = runs.filter((r) => r.mission_id === m.id);
          const open = mine.find((r) => r.status === "in_progress");
          const completed = mine.filter((r) => r.status === "completed");
          const doneSteps = open ? Object.values(open.steps).filter((s) => s.done).length : 0;
          const best = completed.length
            ? Math.max(...completed.map((r) => {
                const sc = missionScore(m, r);
                return sc.graded ? Math.round((sc.correct / sc.graded) * 100) : 0;
              }))
            : null;
          return (
            <Card key={m.id} className="transition-colors hover:ring-primary/40">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{CASE_CATEGORIES[m.category as CaseCategory]}</span>·<span>{DIFFICULTY[m.difficulty]}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" /> {m.estimated_minutes} min
                  </span>
                </div>
                <CardTitle className="leading-snug">
                  <Link href={`/missions/${m.slug}`} className="hover:underline">
                    {m.title}
                  </Link>
                </CardTitle>
                <CardDescription>{m.summary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {m.roles.map((r) => (
                    <ToneBadge key={r} tone="teal">
                      {r}
                    </ToneBadge>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <BookOpenCheck className="size-3.5" /> {m.content.steps.length} passi
                  </span>
                  {open ? <ToneBadge tone="info">In corso · {doneSteps}/{m.content.steps.length}</ToneBadge> : null}
                  {best !== null ? <ToneBadge tone="success">Completata · verifiche corrette {best}%</ToneBadge> : null}
                  {!open && best === null ? <ToneBadge tone="neutral">Da iniziare</ToneBadge> : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
