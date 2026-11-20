import { BookOpen, Crosshair, Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { SelectInput } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AttackText } from "@/features/attack/attack-text";
import { getAttackMeta, getAttackUsage, getTactics, getTechniqueIndex, PLATFORMS } from "@/features/attack/data";
import { ATTACK_HOW_TO, TACTIC_GUIDE } from "@/features/attack/guide";
import { formatDate } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { firstParam } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "MITRE ATT&CK" };

const VIEWS = [
  { key: "matrix", label: "Matrice", icon: Crosshair },
  { key: "tactics", label: "Tattiche spiegate", icon: BookOpen },
  { key: "groups", label: "Gruppi di minaccia", icon: Users },
] as const;

function heat(cases: number) {
  if (cases >= 3) return "border-destructive/50 bg-destructive/15";
  if (cases === 2) return "border-warning/50 bg-warning/15";
  return "border-teal/50 bg-teal/15";
}

export default async function AttackPage({ searchParams }: PageProps<"/attack">) {
  const { active } = await requireActiveOrg();
  const sp = await searchParams;
  const view = (VIEWS.find((v) => v.key === firstParam(sp.view))?.key ?? "matrix") as (typeof VIEWS)[number]["key"];
  const q = (firstParam(sp.q) ?? "").trim().slice(0, 80);
  const platform = firstParam(sp.platform);
  const observedOnly = firstParam(sp.observed) === "1";
  const deep = firstParam(sp.deep) === "1";

  const [meta, tactics, index, usage] = await Promise.all([getAttackMeta(), getTactics(), getTechniqueIndex(), getAttackUsage(active.organizationId)]);

  if (!meta || tactics.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="MITRE ATT&CK" />
        <EmptyState icon={Crosshair} title="Dataset ATT&CK non ancora caricato">
          Un amministratore deve caricare il dataset nel database (vedi docs/ATTACK.md).
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="MITRE ATT&CK"
        eyebrow={`Enterprise v${meta.version}${meta.modified ? ` · aggiornato al ${formatDate(meta.modified)}` : ""}`}
        description="La base di conoscenza delle tattiche e tecniche usate dagli attaccanti nel mondo reale. Usala per capire i fenomeni, dare un nome ai comportamenti osservati nei tuoi casi e individuare mitigazioni e rilevamenti."
      />

      <nav aria-label="Viste ATT&CK" className="flex gap-1 overflow-x-auto border-b">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/attack?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap",
              view === v.key ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <v.icon className="size-4" aria-hidden="true" /> {v.label}
          </Link>
        ))}
      </nav>

      {view === "matrix" ? (
        <MatrixView tactics={tactics} index={index} usage={usage} q={q} platform={platform} observedOnly={observedOnly} deep={deep} />
      ) : null}
      {view === "tactics" ? <TacticsView tactics={tactics} index={index} usage={usage} /> : null}
      {view === "groups" ? <GroupsView q={q} /> : null}

      <p className="border-t pt-4 text-[11px] text-muted-foreground">{meta.attribution}</p>
    </div>
  );
}

async function MatrixView({
  tactics,
  index,
  usage,
  q,
  platform,
  observedOnly,
  deep,
}: {
  tactics: Awaited<ReturnType<typeof getTactics>>;
  index: Awaited<ReturnType<typeof getTechniqueIndex>>;
  usage: Awaited<ReturnType<typeof getAttackUsage>>;
  q: string;
  platform?: string;
  observedOnly: boolean;
  deep: boolean;
}) {
  // Matching technique ids: name/id match, optionally full-text in descriptions.
  let matches: Set<string> | null = null;
  if (q) {
    const needle = q.toLowerCase();
    matches = new Set(index.filter((t) => t.id.toLowerCase().includes(needle) || t.name.toLowerCase().includes(needle)).map((t) => t.id));
    if (deep) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("attack_techniques")
        .select("id")
        .textSearch("search", q.replace(/[^\p{L}\p{N}\s.-]/gu, " "), { type: "websearch", config: "simple" })
        .limit(500);
      (data ?? []).forEach((r) => matches!.add(r.id as string));
    }
  }

  const subsByParent = new Map<string, typeof index>();
  for (const t of index) if (t.parent_id) subsByParent.set(t.parent_id, [...(subsByParent.get(t.parent_id) ?? []), t]);
  const observed = (id: string) => (usage.get(id)?.cases ?? 0) + (subsByParent.get(id) ?? []).reduce((a, s) => a + (usage.get(s.id)?.cases ?? 0), 0);

  const visible = index.filter((t) => {
    if (t.is_subtechnique) return false;
    const subs = subsByParent.get(t.id) ?? [];
    if (platform && !t.platforms.includes(platform)) return false;
    if (matches && !matches.has(t.id) && !subs.some((s) => matches!.has(s.id))) return false;
    if (observedOnly && observed(t.id) === 0) return false;
    return true;
  });
  const observedTotal = new Set([...usage.keys()]).size;

  return (
    <div className="space-y-4">
      <form className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1fr_200px_auto_auto_auto]" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input name="q" defaultValue={q} placeholder="Cerca per ID o nome (es. T1566, phishing, ransomware)" className="pl-8" aria-label="Cerca tecnica" />
        </div>
        <SelectInput name="platform" options={PLATFORMS.map((p) => [p, p] as const)} defaultValue={platform} placeholder="Tutte le piattaforme" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="deep" value="1" defaultChecked={deep} className="size-4" /> Cerca nelle descrizioni
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="observed" value="1" defaultChecked={observedOnly} className="size-4" /> Solo osservate nei miei casi
        </label>
        <Button type="submit" variant="secondary">
          Applica
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{visible.length} tecniche visualizzate</span>
        <span>·</span>
        <span>{observedTotal} tecniche mappate sui casi della tua organizzazione</span>
        <span className="ml-auto flex items-center gap-2">
          Heatmap casi:
          <span className="inline-block size-3 rounded-sm border border-teal/50 bg-teal/15" /> 1
          <span className="inline-block size-3 rounded-sm border border-warning/50 bg-warning/15" /> 2
          <span className="inline-block size-3 rounded-sm border border-destructive/50 bg-destructive/15" /> 3+
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <div className="flex min-w-max gap-2 p-2">
          {tactics.map((tactic) => {
            const items = visible.filter((t) => t.tactics.includes(tactic.shortname));
            const guide = TACTIC_GUIDE[tactic.shortname];
            return (
              <section key={tactic.id} className="w-44 shrink-0" aria-labelledby={`tac-${tactic.id}`}>
                <header className="sticky top-0 mb-2 rounded-md bg-primary/10 px-2 py-1.5">
                  <h3 id={`tac-${tactic.id}`} className="text-xs leading-tight font-semibold">
                    {tactic.name}
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    {guide?.title ?? ""} · {items.length}
                  </p>
                </header>
                <ul className="space-y-1">
                  {items.map((t) => {
                    const n = observed(t.id);
                    const subs = subsByParent.get(t.id)?.length ?? 0;
                    return (
                      <li key={t.id}>
                        <Link
                          href={`/attack/${t.id}`}
                          className={cn(
                            "block rounded border px-1.5 py-1 text-[11px] leading-tight transition-colors hover:border-primary/60",
                            n > 0 ? heat(n) : "border-border bg-background",
                          )}
                          title={n ? `Mappata su ${n} casi` : undefined}
                        >
                          <span className="font-mono text-[10px] text-muted-foreground">{t.id}</span>
                          <span className="block">{t.name}</span>
                          {subs || n ? (
                            <span className="mt-0.5 flex gap-1 text-[10px] text-muted-foreground">
                              {subs ? <span>{subs} sotto-tecniche</span> : null}
                              {n ? <span className="font-medium text-foreground">· {n} casi</span> : null}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TacticsView({
  tactics,
  index,
  usage,
}: {
  tactics: Awaited<ReturnType<typeof getTactics>>;
  index: Awaited<ReturnType<typeof getTechniqueIndex>>;
  usage: Awaited<ReturnType<typeof getAttackUsage>>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ATTACK_HOW_TO.map((h) => (
          <Card key={h.title} size="sm">
            <CardContent className="space-y-1">
              <p className="text-sm font-semibold">{h.title}</p>
              <p className="text-xs text-muted-foreground">{h.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <ol className="space-y-3">
        {tactics.map((t, i) => {
          const g = TACTIC_GUIDE[t.shortname];
          const count = index.filter((x) => !x.is_subtechnique && x.tactics.includes(t.shortname)).length;
          const mapped = index.filter((x) => x.tactics.includes(t.shortname) && usage.has(x.id)).length;
          return (
            <li key={t.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-baseline gap-2">
                    <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                    {g?.title ?? t.name}
                    <span className="text-sm font-normal text-muted-foreground">
                      {t.name} · {t.id}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-2 lg:col-span-1">
                    <p className="text-sm font-medium">{g?.goal}</p>
                    <p className="text-xs text-muted-foreground">
                      {count} tecniche · {mapped ? `${mapped} mappate sui tuoi casi` : "nessuna mappata sui tuoi casi"}
                    </p>
                    <Link href={`/attack?view=matrix#tac-${t.id}`} className="text-xs text-primary hover:underline">
                      Vai alle tecniche →
                    </Link>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Esempi</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-sm">
                      {g?.examples.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Cosa fa l&apos;analista</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-sm">
                      {g?.analyst.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                  <details className="lg:col-span-3">
                    <summary className="cursor-pointer text-xs text-primary">Descrizione originale MITRE (inglese)</summary>
                    <AttackText text={t.description} className="mt-2 space-y-2 text-xs text-muted-foreground" />
                  </details>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

async function GroupsView({ q }: { q: string }) {
  const supabase = await createClient();
  let query = supabase.from("attack_groups").select("id, name, aliases, description").order("name");
  if (q) query = query.or(`name.ilike.%${q.replace(/[%_\\,()*]/g, " ")}%,id.ilike.%${q.replace(/[%_\\,()*]/g, " ")}%`);
  const { data } = await query.limit(300);
  const { data: counts } = await supabase.rpc("attack_group_technique_counts");
  const byGroup = new Map<string, number>(((counts ?? []) as { group_id: string; techniques: number }[]).map((r) => [r.group_id, Number(r.techniques)]));
  return (
    <div className="space-y-4">
      <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        I gruppi sono attori di minaccia documentati pubblicamente da MITRE sulla base di report di terze parti. L&apos;attribuzione è
        complessa e spesso incerta: una tecnica in comune <strong>non</strong> basta ad attribuire un caso a un gruppo.
      </p>
      <form className="flex gap-2">
        <input type="hidden" name="view" value="groups" />
        <Input name="q" defaultValue={q} placeholder="Cerca gruppo (es. APT28, G0007)" aria-label="Cerca gruppo" />
        <Button type="submit" variant="secondary">
          Cerca
        </Button>
      </form>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((g) => (
          <li key={g.id}>
            <Link href={`/attack/groups/${g.id}`} className="block h-full rounded-lg border bg-card p-3 transition-colors hover:border-primary/50">
              <p className="text-sm font-semibold">
                {g.name} <span className="font-mono text-xs font-normal text-muted-foreground">{g.id}</span>
              </p>
              {(g.aliases as string[]).length ? (
                <p className="truncate text-xs text-muted-foreground">Alias: {(g.aliases as string[]).slice(0, 5).join(", ")}</p>
              ) : null}
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{(g.description as string).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}</p>
              <p className="mt-1 text-[11px]">{byGroup.get(g.id) ?? 0} tecniche documentate</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
