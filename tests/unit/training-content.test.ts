import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const dir = path.resolve(import.meta.dirname, "../../supabase/seed/training");

describe("training scenario datasets", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  it("ships the first three scenarios", () => expect(files.length).toBeGreaterThanOrEqual(3));

  it.each(files)("%s is complete, consistent and fictitious", (file) => {
    const s = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    for (const k of ["scenario", "briefing", "objective", "documents", "tasks", "tools", "instructions", "deliverable", "questions"]) {
      expect(s.content[k], k).toBeTruthy();
    }
    expect(s.grading_rubric.reduce((a: number, r: { weight: number }) => a + r.weight, 0)).toBe(100);
    for (const q of s.content.questions) {
      const key = s.answer_key[q.id];
      expect(key, q.id).toBeTruthy();
      if (q.type !== "keywords") {
        const values = q.options.map((o: { value: string }) => o.value);
        for (const c of [key.correct].flat()) expect(values).toContain(c);
      }
    }
    // No question leaks its answer key into the public content.
    expect(JSON.stringify(s.content)).not.toMatch(/"correct"|"explanation"/);
    // Only reserved domains / documentation IPs.
    const text = JSON.stringify(s);
    for (const host of text.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\.(?:com|it|net|org|io)\b/gi) ?? []) {
      expect(host).toMatch(/example\.(com|net|org)$/);
    }
    for (const ip of text.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? []) {
      expect(ip).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113)\./);
    }
  });
});
