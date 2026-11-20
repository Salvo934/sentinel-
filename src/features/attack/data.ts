import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Tactic = { id: string; name: string; shortname: string; description: string; sort_order: number; url: string };
export type TechniqueSummary = {
  id: string;
  name: string;
  is_subtechnique: boolean;
  parent_id: string | null;
  tactics: string[];
  platforms: string[];
};
export type AttackMeta = { version: string; modified: string | null; attribution: string };

export const PLATFORMS = [
  "Windows",
  "macOS",
  "Linux",
  "Office Suite",
  "Identity Provider",
  "SaaS",
  "IaaS",
  "Containers",
  "Network Devices",
  "ESXi",
  "PRE",
] as const;

export async function getAttackMeta(): Promise<AttackMeta | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("attack_meta").select("version, modified, attribution").maybeSingle();
  return (data as AttackMeta | null) ?? null;
}

export async function getTactics(): Promise<Tactic[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("attack_tactics").select("id, name, shortname, description, sort_order, url").order("sort_order");
  return (data ?? []) as Tactic[];
}

/** All techniques without descriptions (light payload for the matrix and pickers). */
export async function getTechniqueIndex(): Promise<TechniqueSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attack_techniques")
    .select("id, name, is_subtechnique, parent_id, tactics, platforms")
    .order("id")
    .limit(2000);
  return (data ?? []) as TechniqueSummary[];
}

export async function getAttackUsage(orgId: string, includeDemo = true): Promise<Map<string, { cases: number; verified: number }>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("attack_usage", { p_org: orgId, p_include_demo: includeDemo });
  return new Map(((data ?? []) as { technique_id: string; cases: number; verified: number }[]).map((r) => [r.technique_id, { cases: Number(r.cases), verified: Number(r.verified) }]));
}

/** Options for technique pickers: "T1566.002 — Phishing: Spearphishing Link". */
export function techniqueOptions(index: TechniqueSummary[]): (readonly [string, string])[] {
  const names = new Map(index.map((t) => [t.id, t.name]));
  return index.map((t) => [t.id, `${t.id} — ${t.parent_id ? `${names.get(t.parent_id)}: ` : ""}${t.name}`] as const);
}
