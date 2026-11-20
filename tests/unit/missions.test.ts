import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeEmail } from "@/features/phishing/parser";
import { PHISHING_SAMPLES } from "@/features/phishing/samples";
import { resolveHref } from "@/features/missions/types";

type RawMission = {
  slug: string;
  kind: "guided" | "real_case";
  category: string;
  content: {
    dossier?: { how_it_works: { technique: string | null }[]; figures: { source: number }[] };
    materials: { type: string; sample_key?: string; href?: string; body?: string }[];
    steps: { id: string; module?: { href: string }; check?: { type: string; any_of?: string[] }; quiz?: { type: string } }[];
    sources: { url: string; title: string; publisher: string }[];
  };
  keys: { steps: Record<string, { senior: string }>; debrief: { summary: string } };
};

const dir = path.resolve(import.meta.dirname, "../../supabase/seed/missions");
const missions: RawMission[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
const attack = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../public/data/mitre-attack-enterprise.json"), "utf8")) as {
  techniques: { id: string }[];
};
const techniqueIds = new Set(attack.techniques.map((t) => t.id));
const sampleKeys = new Set(PHISHING_SAMPLES.map((s) => s.key));
const sample = (key: string) => analyzeEmail(PHISHING_SAMPLES.find((s) => s.key === key)!.raw);
const findingIds = (key: string) => sample(key).findings.map((f) => f.id);

describe("missions content", () => {
  it("has at least 4 guided missions and 9 real cases", () => {
    expect(missions.filter((m) => m.kind === "guided").length).toBeGreaterThanOrEqual(4);
    expect(missions.filter((m) => m.kind === "real_case").length).toBeGreaterThanOrEqual(9);
  });

  it.each(missions.map((m) => [m.slug, m] as const))("%s is internally consistent", (_slug, m) => {
    for (const s of m.content.steps) expect(m.keys.steps[s.id]?.senior, `${s.id} senior`).toBeTruthy();
    expect(m.keys.debrief.summary).toBeTruthy();
    for (const mat of m.content.materials) if (mat.type === "sample") expect(sampleKeys.has(mat.sample_key!), mat.sample_key).toBe(true);
    for (const s of m.content.steps) {
      for (const id of s.check?.any_of ?? []) expect(techniqueIds.has(id), `${s.id}: ${id}`).toBe(true);
      if (s.module?.href.startsWith("/phishing?sample=")) expect(sampleKeys.has(s.module.href.split("=")[1]!)).toBe(true);
    }
    for (const h of m.content.dossier?.how_it_works ?? []) if (h.technique) expect(techniqueIds.has(h.technique), h.technique).toBe(true);
  });

  it.each(missions.filter((m) => m.kind === "real_case").map((m) => [m.slug, m] as const))("%s cites verifiable sources", (_slug, m) => {
    expect(m.content.sources.length).toBeGreaterThanOrEqual(2);
    for (const s of m.content.sources) expect(s.url).toMatch(/^https:\/\//);
    for (const f of m.content.dossier!.figures) expect(m.content.sources[f.source - 1], `source ${f.source}`).toBeDefined();
  });

  // Official domains may appear only as the deceptive *visible text* of a link.
  const LEGIT_DISPLAY_ONLY = new Set(["pagopa.gov.it"]);

  it("uses only fictitious domains and documentation IPs in exercise material", () => {
    const realCaseSamples = PHISHING_SAMPLES.filter((s) => s.key.startsWith("real-"));
    const texts = [...realCaseSamples.map((s) => s.raw), ...missions.flatMap((m) => m.content.materials.map((x) => x.body ?? ""))];
    for (const t of texts) {
      for (const host of t.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|it|net|org|io|eu)\b/gi) ?? []) {
        if (LEGIT_DISPLAY_ONLY.has(host.toLowerCase())) continue;
        expect(host, host).toMatch(/example\.(com|net|org)$/);
      }
      for (const ip of t.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? []) {
        expect(ip, ip).toMatch(/^(192\.0\.2\.|198\.51\.100\.|203\.0\.113\.|10\.)/);
      }
    }
  });
});

describe("reconstructions contain what the quizzes ask about", () => {
  it("fake invoice: SPF/DMARC fail, divergent Reply-To, risky attachment", () => {
    const a = sample("fake-invoice");
    expect(a.auth.spf).toBe("fail");
    expect(a.auth.dmarc).toBe("fail");
    expect(findingIds("fake-invoice")).toContain("reply-to");
    expect(a.attachments.some((x) => x.risky)).toBe(true);
  });

  it("PagoPA: the official domain is only the visible text, never the destination", () => {
    for (const u of sample("real-pagopa-multa").urls) expect(u.host).not.toBe("pagopa.gov.it");
  });

  it("PagoPA: urgency, foreign domain, failed authentication", () => {
    const ids = findingIds("real-pagopa-multa");
    expect(ids).toContain("urgency");
    expect(ids).toContain("auth-dmarc");
    expect(ids.some((i) => i.startsWith("link-mismatch") || i.startsWith("link-ext"))).toBe(true);
  });

  it("PEC: authentication passes although the message is malicious", () => {
    const a = sample("real-pec-sollecito");
    expect([a.auth.spf, a.auth.dkim, a.auth.dmarc]).toEqual(["pass", "pass", "pass"]);
    expect(a.urls[0]?.host).toBe("documenti-condivisi-cloud.example");
  });

  it("malspam: compressed attachment with double extension", () => {
    expect(sample("real-malspam-ordine").attachments[0]).toMatchObject({ filename: "PO-2026-0453.pdf.rar", risky: true });
  });

  it("ClickFix and SMS reconstructions expose their link as inert text", () => {
    for (const key of ["real-clickfix-corriere", "real-inps-sms", "real-mirax-sms"]) {
      const urls = sample(key).urls;
      expect(urls.length, key).toBeGreaterThan(0);
      for (const u of urls) expect(u.defanged).not.toMatch(/^https?:\/\//);
    }
  });

  it("BEC: Reply-To on free webmail", () => {
    expect(findingIds("bec")).toContain("reply-freemail");
  });
});

describe("resolveHref", () => {
  it("fills the linked case or hides links that need it", () => {
    expect(resolveHref("/investigations/{case}?tab=attack", "abc")).toBe("/investigations/abc?tab=attack");
    expect(resolveHref("/evidence/new?case={case}", null)).toBeNull();
    expect(resolveHref("/phishing?sample=bec", null)).toBe("/phishing?sample=bec");
  });
});
