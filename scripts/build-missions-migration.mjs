#!/usr/bin/env node
/**
 * Generates the missions content migration from supabase/seed/missions/*.json.
 * Answer keys, senior notes and debriefs go to public.mission_keys (no API
 * access); everything else to public.missions. Re-runnable: upserts by slug.
 *
 *   node scripts/build-missions-migration.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "supabase/seed/missions");
const out = path.join(root, "supabase/migrations/20261120101100_missions_content.sql");
const CHECKS = new Set(["none", "case", "objective", "tasks", "evidence", "phishing", "domain", "ioc", "finding", "sources", "timeline", "attack", "report", "risk_set", "closed"]);

const lit = (v) => `'${String(v).replaceAll("'", "''")}'`;
const json = (v) => `${lit(JSON.stringify(v))}::jsonb`;

const missions = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .flatMap((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")).map((m) => ({ ...m, file: f })));

const slugs = new Set();
for (const m of missions) {
  const where = `${m.file}:${m.slug}`;
  if (slugs.has(m.slug)) throw new Error(`${where}: duplicate slug`);
  slugs.add(m.slug);
  const ids = new Set();
  for (const s of m.content.steps) {
    if (ids.has(s.id)) throw new Error(`${where}: duplicate step ${s.id}`);
    ids.add(s.id);
    if (s.check && !CHECKS.has(s.check.type)) throw new Error(`${where}/${s.id}: unknown check ${s.check.type}`);
    const key = m.keys.steps[s.id];
    if (!key?.senior) throw new Error(`${where}/${s.id}: missing senior note`);
    if (s.quiz && ["single", "multi"].includes(s.quiz.type)) {
      const values = new Set(s.quiz.options.map((o) => o.value));
      for (const c of [key.correct].flat()) if (!values.has(c)) throw new Error(`${where}/${s.id}: answer ${c} not among options`);
    }
  }
  if (m.kind === "real_case" && (m.content.sources ?? []).length < 2) throw new Error(`${where}: real cases need at least 2 sources`);
  if (!m.keys.debrief?.summary) throw new Error(`${where}: missing debrief`);
}

const blocks = missions.map(
  (m) => `-- ${m.file} · ${m.slug}
insert into public.missions (slug, kind, sort_order, title, summary, difficulty, category, roles, estimated_minutes, content)
values (${lit(m.slug)}, ${lit(m.kind)}, ${m.sort_order}, ${lit(m.title)}, ${lit(m.summary)}, ${lit(m.difficulty)}, ${lit(m.category)},
        array[${m.roles.map(lit).join(", ")}]::text[], ${m.estimated_minutes}, ${json(m.content)})
on conflict (slug) do update set kind = excluded.kind, sort_order = excluded.sort_order, title = excluded.title,
  summary = excluded.summary, difficulty = excluded.difficulty, category = excluded.category, roles = excluded.roles,
  estimated_minutes = excluded.estimated_minutes, content = excluded.content;

insert into public.mission_keys (mission_id, steps, debrief)
select id, ${json(m.keys.steps)}, ${json(m.keys.debrief)} from public.missions where slug = ${lit(m.slug)}
on conflict (mission_id) do update set steps = excluded.steps, debrief = excluded.debrief;
`,
);

writeFileSync(
  out,
  `-- =============================================================================
-- Sentinel Intelligence — 011 Missions content (GENERATED FILE)
-- Source: supabase/seed/missions/*.json — regenerate with
--   node scripts/build-missions-migration.mjs
-- Real cases cite public sources (CERT-AGID, ACN, INPS, vendors, press);
-- messages, logs, domains and IPs used in the exercises are fictitious.
-- =============================================================================

${blocks.join("\n")}`,
);
console.log(`Wrote ${path.relative(root, out)} (${missions.length} missions, ${(blocks.join("").length / 1024).toFixed(0)} KB)`);
