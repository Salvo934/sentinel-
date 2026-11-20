import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttackText } from "@/features/attack/attack-text";
import { getTactics } from "@/features/attack/data";
import { TACTIC_GUIDE } from "@/features/attack/guide";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gruppo ATT&CK" };

export default async function GroupPage({ params }: PageProps<"/attack/groups/[id]">) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw).toUpperCase();
  if (!/^G\d{4}$/.test(id)) notFound();
  await requireActiveOrg();
  const supabase = await createClient();
  const { data: g } = await supabase.from("attack_groups").select("*").eq("id", id).maybeSingle();
  if (!g) notFound();

  const [tactics, { data: rows }] = await Promise.all([
    getTactics(),
    supabase.from("attack_group_techniques").select("attack_techniques(id, name, tactics, parent_id)").eq("group_id", id).limit(1000),
  ]);
  const techniques = (rows ?? [])
    .map((r) => r.attack_techniques as unknown as { id: string; name: string; tactics: string[]; parent_id: string | null } | null)
    .filter((t): t is { id: string; name: string; tactics: string[]; parent_id: string | null } => Boolean(t))
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/attack?view=groups", label: "Gruppi di minaccia" }}
        eyebrow={<span className="font-mono">{g.id}</span>}
        title={g.name}
        description={
          <div className="space-y-1">
            {(g.aliases as string[]).length ? <p>Alias: {(g.aliases as string[]).join(", ")}</p> : null}
            <a href={g.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              attack.mitre.org <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        }
      />
      <FormAlert tone="info">
        Profilo basato su fonti aperte raccolte da MITRE. Usalo per capire come opera un attore e quali tecniche aspettarsi, non per
        attribuire automaticamente un caso: l&apos;attribuzione richiede più elementi indipendenti e resta un giudizio con un livello di confidenza.
      </FormAlert>
      <div className="grid gap-4 xl:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Descrizione (MITRE, inglese)</CardTitle>
          </CardHeader>
          <CardContent>
            <AttackText text={g.description} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tecniche documentate per tattica ({techniques.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tactics.map((tac) => {
              const list = techniques.filter((t) => t.tactics.includes(tac.shortname));
              if (!list.length) return null;
              return (
                <section key={tac.id}>
                  <h3 className="mb-1 text-sm font-semibold">
                    {TACTIC_GUIDE[tac.shortname]?.title ?? tac.name} <span className="font-normal text-muted-foreground">({list.length})</span>
                  </h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {list.map((t) => (
                      <li key={t.id}>
                        <Link href={`/attack/${t.id}`} className="inline-block rounded border px-1.5 py-0.5 text-xs hover:border-primary/60">
                          <span className="font-mono text-muted-foreground">{t.id}</span> {t.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
