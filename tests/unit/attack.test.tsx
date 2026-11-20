import { readFileSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AttackText } from "@/features/attack/attack-text";
import { TACTIC_GUIDE } from "@/features/attack/guide";
import { ATTACK_ID_RE, suggestFromDomain, suggestFromEmail } from "@/features/attack/suggest";
import { simulatedReport } from "@/features/domains/model";
import { analyzeEmail } from "@/features/phishing/parser";
import { PHISHING_SAMPLES } from "@/features/phishing/samples";

type Bundle = {
  meta: { version: string; attribution: string };
  tactics: { id: string; shortname: string }[];
  techniques: { id: string; parent_id: string | null; tactics: string[] }[];
  mitigations: { id: string }[];
  groups: { id: string }[];
  technique_mitigations: { technique_id: string; mitigation_id: string }[];
  group_techniques: { group_id: string; technique_id: string }[];
  detections: { technique_id: string }[];
};
const bundle: Bundle = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../../public/data/mitre-attack-enterprise.json"), "utf8"),
);
const techniqueIds = new Set(bundle.techniques.map((t) => t.id));

describe("ATT&CK dataset", () => {
  it("is consistent and attributed", () => {
    expect(bundle.meta.attribution).toMatch(/MITRE Corporation/);
    expect(bundle.tactics).toHaveLength(15);
    for (const t of bundle.techniques) {
      expect(t.id).toMatch(ATTACK_ID_RE);
      if (t.parent_id) expect(techniqueIds.has(t.parent_id)).toBe(true);
    }
    const mitigations = new Set(bundle.mitigations.map((m) => m.id));
    const groups = new Set(bundle.groups.map((g) => g.id));
    expect(bundle.technique_mitigations.every((r) => techniqueIds.has(r.technique_id) && mitigations.has(r.mitigation_id))).toBe(true);
    expect(bundle.group_techniques.every((r) => techniqueIds.has(r.technique_id) && groups.has(r.group_id))).toBe(true);
    expect(bundle.detections.every((d) => techniqueIds.has(d.technique_id))).toBe(true);
  });

  it("has an Italian guide for every tactic", () => {
    for (const t of bundle.tactics) expect(TACTIC_GUIDE[t.shortname], t.shortname).toBeDefined();
  });
});

describe("ATT&CK suggestions", () => {
  const sample = (key: string) => analyzeEmail(PHISHING_SAMPLES.find((s) => s.key === key)!.raw);

  it("only suggests techniques that exist in the loaded release", () => {
    const all = [
      ...PHISHING_SAMPLES.flatMap((s) => suggestFromEmail(analyzeEmail(s.raw))),
      ...suggestFromDomain(simulatedReport("velora-componenti-supporto.example")),
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) expect(techniqueIds.has(s.techniqueId), s.techniqueId).toBe(true);
  });

  it("maps the fake courier sample to link, attachment and impersonation techniques", () => {
    const ids = suggestFromEmail(sample("fake-courier")).map((s) => s.techniqueId);
    expect(ids).toEqual(expect.arrayContaining(["T1566.001", "T1566.002", "T1204.001", "T1684.001"]));
  });

  it("recognises business email compromise", () => {
    const ids = suggestFromEmail(sample("bec")).map((s) => s.techniqueId);
    expect(ids).toEqual(expect.arrayContaining(["T1684.001", "T1585.002", "T1657"]));
    expect(ids).not.toContain("T1566.001");
  });

  it("suggests domain acquisition for young look-alike domains only", () => {
    expect(suggestFromDomain(simulatedReport("velora-componenti-supporto.example")).map((s) => s.techniqueId)).toContain("T1583.001");
    expect(suggestFromDomain(simulatedReport("velora-componenti.example"))).toEqual([]);
  });

  it("every suggestion explains why", () => {
    for (const s of suggestFromEmail(sample("fake-invoice"))) expect(s.reason.length).toBeGreaterThan(10);
  });
});

describe("AttackText", () => {
  it("links ATT&CK references internally and never renders external links or HTML", () => {
    const { container } = render(
      <AttackText
        text={"Uses [User Execution](https://attack.mitre.org/techniques/T1204/002) and [a blog](https://evil.example/x).\n\n<script>alert(1)</script>"}
      />,
    );
    const internal = screen.getByRole("link", { name: "User Execution" });
    expect(internal.getAttribute("href")).toBe("/attack/T1204.002");
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("a blog");
  });
});
