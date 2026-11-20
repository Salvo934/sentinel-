#!/usr/bin/env node
/**
 * Generates the Training Academy data migration from supabase/seed/training/*.json.
 * The answer key and guided solution go to public.training_answer_keys (no API
 * access); everything else to public.training_scenarios. Re-runnable: upserts by slug.
 *
 *   node scripts/build-training-migration.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "supabase/seed/training");
const out = path.join(root, "supabase/migrations/20261120100600_training_content.sql");

const lit = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${lit(JSON.stringify(value))}::jsonb`;

const blocks = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((file) => {
    const s = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    for (const key of ["slug", "title", "content", "answer_key", "solution"]) {
      if (!s[key]) throw new Error(`${file}: missing ${key}`);
    }
    for (const q of s.content.questions) {
      if (!s.answer_key[q.id]) throw new Error(`${file}: no answer for question ${q.id}`);
    }
    const skills = `array[${s.skills.map(lit).join(", ")}]::text[]`;
    return `-- ${file}
insert into public.training_scenarios (slug, sort_order, title, description, difficulty, category, estimated_minutes, skills, content, grading_rubric)
values (${lit(s.slug)}, ${s.sort_order}, ${lit(s.title)}, ${lit(s.description)}, ${lit(s.difficulty)}, ${lit(s.category)},
        ${s.estimated_minutes}, ${skills}, ${json(s.content)}, ${json(s.grading_rubric)})
on conflict (slug) do update set
  sort_order = excluded.sort_order, title = excluded.title, description = excluded.description,
  difficulty = excluded.difficulty, category = excluded.category, estimated_minutes = excluded.estimated_minutes,
  skills = excluded.skills, content = excluded.content, grading_rubric = excluded.grading_rubric;

insert into public.training_answer_keys (scenario_id, answer_key, solution)
select id, ${json(s.answer_key)}, ${json(s.solution)} from public.training_scenarios where slug = ${lit(s.slug)}
on conflict (scenario_id) do update set answer_key = excluded.answer_key, solution = excluded.solution;
`;
  });

writeFileSync(
  out,
  `-- =============================================================================
-- Sentinel Intelligence — 007 Training Academy content (GENERATED FILE)
-- Source: supabase/seed/training/*.json — regenerate with
--   node scripts/build-training-migration.mjs
-- All scenarios use fictitious organizations, people, domains and IPs.
-- =============================================================================

${blocks.join("\n")}`,
);
console.log(`Wrote ${path.relative(root, out)} (${blocks.length} scenarios)`);
