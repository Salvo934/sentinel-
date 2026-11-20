import {
  Activity,
  CheckCircle2,
  FileText,
  FlaskConical,
  FolderKanban,
  FolderOpen,
  GraduationCap,
  ListTodo,
  Radar,
  ShieldAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAttackUsage } from "@/features/attack/data";
import { ActivityArea, HorizontalBars } from "@/features/dashboard/charts";
import { StatCard } from "@/features/dashboard/stat-card";
import { describeAction } from "@/lib/audit-labels";
import { CASE_CATEGORIES, IOC_TYPES, RISK_LEVELS } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

type Stats = {
  cases_open: number;
  cases_in_progress: number;
  cases_closed: number;
  iocs_total: number;
  threats_identified: number;
  reports_total: number;
  tasks_open: number;
  phishing_analyses: number;
  domain_analyses: number;
  cases_by_category: Record<string, number>;
  cases_by_risk: Record<string, number>;
  iocs_by_type: Record<string, number>;
  activity_30d: { day: string; count: number }[];
  demo_loaded: boolean;
};

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { active, user } = await requireActiveOrg();
  const includeDemo = (await searchParams).demo !== "0";
  const supabase = await createClient();
  const org = active.organizationId;

  const [statsRes, auditRes, tasksRes, scenariosRes, attemptsRes, attackUsage] = await Promise.all([
    supabase.rpc("dashboard_stats", { p_org: org, p_include_demo: includeDemo }),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, metadata, case_id, user_id, created_at")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("case_tasks")
      .select("id, title, status, due_at, case_id, cases!inner(title, organization_id, is_demo)")
      .in("status", ["todo", "in_progress"])
      .eq("cases.organization_id", org)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase.from("training_scenarios").select("id, slug, title, difficulty, estimated_minutes").order("sort_order"),
    supabase.from("training_attempts").select("scenario_id, status, score, max_score").eq("user_id", user.id),
    getAttackUsage(org, includeDemo),
  ]);
  const topTechniqueIds = [...attackUsage.entries()].sort((a, b) => b[1].cases - a[1].cases).slice(0, 8);
  const { data: topTechniqueNames } = topTechniqueIds.length
    ? await supabase.from("attack_techniques").select("id, name").in("id", topTechniqueIds.map(([id]) => id))
    : { data: [] as { id: string; name: string }[] };
  const topTechniques = topTechniqueIds.map(([id, u]) => ({
    label: `${id} ${topTechniqueNames?.find((t) => t.id === id)?.name ?? ""}`.trim(),
    value: u.cases,
  }));

  if (statsRes.error) {
    return (
      <EmptyState icon={ShieldAlert} title="Impossibile caricare le statistiche">
        Verifica la connessione a Supabase e che le migrazioni siano state applicate.
      </EmptyState>
    );
  }
  const s = statsRes.data as Stats;
  const tasks = (tasksRes.data ?? []).filter((t) => includeDemo || !(t.cases as unknown as { is_demo: boolean }).is_demo);
  const attempts = attemptsRes.data ?? [];
  const scenarios = scenariosRes.data ?? [];
  const completed = new Set(attempts.filter((a) => a.status === "submitted").map((a) => a.scenario_id));
  const submitted = attempts.filter((a) => a.status === "submitted" && a.max_score);
  const avg = submitted.length
    ? Math.round((submitted.reduce((acc, a) => acc + Number(a.score) / Number(a.max_score), 0) / submitted.length) * 100)
    : null;

  const userIds = [...new Set((auditRes.data ?? []).map((a) => a.user_id).filter(Boolean))] as string[];
  const { data: people } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameOf = (id: string | null) => people?.find((p) => p.id === id)?.full_name ?? "Utente";

  const byCategory = Object.entries(CASE_CATEGORIES).map(([k, label]) => ({ label, value: s.cases_by_category[k] ?? 0 }));
  const byRisk = Object.entries(RISK_LEVELS).map(([k, label]) => ({ label, value: s.cases_by_risk[k] ?? 0 }));
  const byIoc = Object.entries(IOC_TYPES).map(([k, label]) => ({ label, value: s.iocs_by_type[k] ?? 0 }));
  const activity = s.activity_30d.map((d) => ({
    label: new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(new Date(d.day)),
    value: d.count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard operativa"
        description="Panoramica dei casi, degli indicatori e dei progressi formativi. Tutti i valori sono calcolati dai dati salvati in Supabase."
        actions={
          s.demo_loaded ? (
            <Button asChild variant="outline" size="sm">
              <Link href={includeDemo ? "/dashboard?demo=0" : "/dashboard"}>
                <FlaskConical /> {includeDemo ? "Escludi dati demo" : "Includi dati demo"}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/settings#demo">
                <FlaskConical /> Carica dati demo
              </Link>
            </Button>
          )
        }
      />

      {s.demo_loaded && includeDemo ? (
        <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
          <FlaskConical className="mr-1 inline size-3.5 text-warning" aria-hidden="true" />
          I conteggi includono <strong className="text-foreground">dati simulati della modalità demo</strong> (etichettati &quot;Demo&quot;).
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicatori principali">
        <StatCard label="Casi aperti" value={s.cases_open} icon={FolderOpen} href="/investigations?status=open" />
        <StatCard label="Casi in lavorazione" value={s.cases_in_progress} icon={FolderKanban} href="/investigations?status=in_progress" />
        <StatCard label="Casi chiusi" value={s.cases_closed} icon={CheckCircle2} href="/investigations?status=closed" />
        <StatCard label="Attività da completare" value={s.tasks_open} icon={ListTodo} />
        <StatCard label="IOC registrati" value={s.iocs_total} icon={Radar} href="/threat-intel" />
        <StatCard label="Minacce identificate" value={s.threats_identified} icon={ShieldAlert} hint="IOC con verdetto sospetto o malevolo" href="/threat-intel" />
        <StatCard label="Report prodotti" value={s.reports_total} icon={FileText} href="/reports" />
        <StatCard
          label="Esercitazioni completate"
          value={`${completed.size}/${scenarios.length}`}
          icon={GraduationCap}
          hint={avg !== null ? `Media punteggio formativo: ${avg}%` : "Nessuna consegna ancora"}
          href="/training"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Casi per categoria</CardTitle>
            <CardDescription>Numero di casi per tipologia di indagine</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBars data={byCategory} unit="casi" />
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Livelli di rischio</CardTitle>
              <CardDescription>Valutazione dell&apos;analista sui casi non archiviati</CardDescription>
            </CardHeader>
            <CardContent>
              <HorizontalBars data={byRisk} unit="casi" color="var(--chart-3)" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>IOC per tipologia</CardTitle>
            </CardHeader>
            <CardContent>
              <HorizontalBars data={byIoc} unit="indicatori" color="var(--chart-2)" />
            </CardContent>
          </Card>
        </div>
      </section>

      {topTechniques.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Tecniche MITRE ATT&amp;CK più osservate</CardTitle>
            <CardDescription>
              Numero di casi su cui ogni tecnica è mappata ·{" "}
              <Link href="/attack?observed=1" className="underline">
                apri la matrice
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBars data={topTechniques} unit="casi" color="var(--chart-4)" />
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Andamento delle attività (30 giorni)</CardTitle>
            <CardDescription>Operazioni registrate nell&apos;audit log dell&apos;organizzazione</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityArea data={activity} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attività da completare</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna attività aperta.</p>
            ) : (
              <ul className="divide-y text-sm">
                {tasks.map((t) => (
                  <li key={t.id} className="py-2">
                    <Link href={`/investigations/${t.case_id}?tab=tasks`} className="font-medium hover:underline">
                      {t.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {(t.cases as unknown as { title: string }).title}
                      {t.due_at ? ` · scadenza ${formatDate(t.due_at)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" aria-hidden="true" /> Ultime attività investigative
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(auditRes.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna attività registrata.</p>
            ) : (
              <ul className="divide-y text-sm">
                {auditRes.data!.map((a) => {
                  const title = (a.metadata as { title?: string })?.title;
                  return (
                    <li key={a.id} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium">{describeAction(a.action)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {title ? `${title} · ` : ""}
                          {nameOf(a.user_id)}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs text-muted-foreground" dateTime={a.created_at}>
                        {formatDateTime(a.created_at)}
                      </time>
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
              <GraduationCap className="size-4" aria-hidden="true" /> Esercitazioni disponibili
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {scenarios.map((sc) => (
                <li key={sc.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/training/${sc.slug}`} className="min-w-0 truncate font-medium hover:underline">
                    {sc.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {completed.has(sc.id) ? "Completata" : `${sc.estimated_minutes} min`}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
