import { ExternalLink, Eye, Shield, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfidenceBadge, InfoStatusBadge } from "@/components/common/badges";
import { ToneBadge } from "@/components/common/tone-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AttackText } from "@/features/attack/attack-text";
import { MapTechniqueForm } from "@/features/attack/components/map-technique-form";
import { getTactics } from "@/features/attack/data";
import { TACTIC_GUIDE } from "@/features/attack/guide";
import { ATTACK_ID_RE } from "@/features/attack/suggest";
import { getCaseOptions } from "@/features/cases/data";
import type { Confidence, InfoStatus } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tecnica ATT&CK" };

type Analytic = { id: string; platforms: string[]; description: string };

export default async function TechniquePage({ params }: PageProps<"/attack/[id]">) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw).toUpperCase();
  if (!ATTACK_ID_RE.test(id)) notFound();
  const { active } = await requireActiveOrg();
  const supabase = await createClient();

  const { data: t } = await supabase.from("attack_techniques").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();

  const [tactics, parentRes, subsRes, mitRes, detRes, groupsRes, mappingsRes, cases] = await Promise.all([
    getTactics(),
    t.parent_id ? supabase.from("attack_techniques").select("id, name").eq("id", t.parent_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("attack_techniques").select("id, name").eq("parent_id", id).order("id"),
    supabase.from("attack_technique_mitigations").select("description, attack_mitigations(id, name, description, url)").eq("technique_id", id),
    supabase.from("attack_detection_strategies").select("id, name, analytics, url").eq("technique_id", id),
    supabase.from("attack_group_techniques").select("attack_groups(id, name)").eq("technique_id", id).limit(200),
    supabase
      .from("case_attack_techniques")
      .select("id, info_status, confidence, observation, case_id, cases!inner(case_ref, title, organization_id)")
      .eq("technique_id", id)
      .eq("cases.organization_id", active.organizationId),
    getCaseOptions(active.organizationId),
  ]);

  const techTactics = tactics.filter((x) => (t.tactics as string[]).includes(x.shortname));
  const groups = (groupsRes.data ?? [])
    .map((r) => r.attack_groups as unknown as { id: string; name: string } | null)
    .filter((g): g is { id: string; name: string } => Boolean(g))
    .sort((a, b) => a.name.localeCompare(b.name));
  const mitigations = (mitRes.data ?? []).map((r) => ({
    how: r.description as string | null,
    ...(r.attack_mitigations as unknown as { id: string; name: string; description: string; url: string }),
  }));
  const mappings = mappingsRes.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/attack", label: "MITRE ATT&CK" }}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{t.id}</span>
            {parentRes.data ? (
              <>
                · sotto-tecnica di{" "}
                <Link href={`/attack/${parentRes.data.id}`} className="underline">
                  {parentRes.data.id} {parentRes.data.name}
                </Link>
              </>
            ) : null}
          </span>
        }
        title={parentRes.data ? `${parentRes.data.name}: ${t.name}` : t.name}
        description={
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {techTactics.map((x) => (
              <ToneBadge key={x.id} tone="info">
                {TACTIC_GUIDE[x.shortname]?.title ?? x.name}
              </ToneBadge>
            ))}
            {(t.platforms as string[]).map((p) => (
              <ToneBadge key={p} tone="neutral">
                {p}
              </ToneBadge>
            ))}
            <a href={t.url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              attack.mitre.org <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>In quale fase dell&apos;attacco si colloca</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {techTactics.map((x) => {
                const g = TACTIC_GUIDE[x.shortname];
                return (
                  <div key={x.id} className="rounded-lg border-l-4 border-teal bg-teal/5 px-3 py-2">
                    <p className="text-sm font-semibold">
                      {g?.title ?? x.name} <span className="font-normal text-muted-foreground">({x.name})</span>
                    </p>
                    <p className="text-sm">{g?.goal}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Descrizione</CardTitle>
              <CardDescription>Testo originale MITRE (inglese). I riferimenti ad altre tecniche sono collegati.</CardDescription>
            </CardHeader>
            <CardContent>
              <AttackText text={t.description} />
              <p className="mt-3 text-[11px] text-muted-foreground">
                Versione {t.version ?? "—"}
                {t.modified ? ` · modificata il ${formatDate(t.modified)}` : ""}
              </p>
            </CardContent>
          </Card>

          {(subsRes.data ?? []).length ? (
            <Card>
              <CardHeader>
                <CardTitle>Sotto-tecniche</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {subsRes.data!.map((s) => (
                    <li key={s.id}>
                      <Link href={`/attack/${s.id}`} className="text-sm hover:underline">
                        <span className="font-mono text-xs text-muted-foreground">{s.id}</span> {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-4" aria-hidden="true" /> Mitigazioni
              </CardTitle>
              <CardDescription>Misure che riducono la probabilità o l&apos;impatto della tecnica.</CardDescription>
            </CardHeader>
            <CardContent>
              {mitigations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  MITRE non documenta mitigazioni preventive specifiche: spesso la tecnica sfrutta funzionalità legittime e va gestita con il rilevamento.
                </p>
              ) : (
                <ul className="space-y-2">
                  {mitigations.map((m) => (
                    <li key={m.id} className="rounded-lg border p-3">
                      <p className="text-sm font-medium">
                        <span className="font-mono text-xs text-muted-foreground">{m.id}</span> {m.name}
                      </p>
                      {m.how ? <AttackText text={m.how} className="mt-1 space-y-1 text-sm text-muted-foreground" /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="size-4" aria-hidden="true" /> Come rilevarla
              </CardTitle>
              <CardDescription>Strategie di rilevamento MITRE con le analisi per piattaforma.</CardDescription>
            </CardHeader>
            <CardContent>
              {(detRes.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessuna strategia di rilevamento documentata.</p>
              ) : (
                (detRes.data ?? []).map((d) => (
                  <div key={d.id} className="space-y-2">
                    <p className="text-sm font-medium">
                      <span className="font-mono text-xs text-muted-foreground">{d.id}</span> {d.name}
                    </p>
                    <ul className="space-y-2">
                      {(d.analytics as Analytic[]).map((a) => (
                        <li key={a.id} className="rounded-md bg-muted/40 p-2 text-xs">
                          <span className="font-medium">{a.platforms.join(", ") || "Generale"}</span>
                          <AttackText text={a.description} className="mt-1 space-y-1 text-muted-foreground" />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nei casi della tua organizzazione</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mappings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tecnica non ancora mappata su nessun caso.</p>
              ) : (
                <ul className="divide-y">
                  {mappings.map((m) => {
                    const c = m.cases as unknown as { case_ref: string; title: string };
                    return (
                      <li key={m.id} className="space-y-1 py-2">
                        <Link href={`/investigations/${m.case_id}?tab=attack`} className="text-sm font-medium hover:underline">
                          {c.case_ref} · {c.title}
                        </Link>
                        <div className="flex flex-wrap gap-1">
                          <InfoStatusBadge value={m.info_status as InfoStatus} />
                          <ConfidenceBadge value={m.confidence as Confidence} />
                        </div>
                        {m.observation ? <p className="text-xs text-muted-foreground">{m.observation}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {cases.length ? (
                <details>
                  <summary className="cursor-pointer text-sm text-primary">Mappa questa tecnica su un caso</summary>
                  <div className="mt-3">
                    <MapTechniqueForm techniqueId={t.id} caseOptions={cases} source="attack_page" compact />
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" aria-hidden="true" /> Gruppi che la usano ({groups.length})
              </CardTitle>
              <CardDescription>Documentati da MITRE: non è un elemento sufficiente per attribuire un caso.</CardDescription>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun gruppo documentato.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((g) => (
                    <Link key={g.id} href={`/attack/groups/${g.id}`} className="rounded-full border px-2 py-0.5 text-xs hover:border-primary/60">
                      {g.name}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
