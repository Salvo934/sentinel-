import { describe, expect, it } from "vitest";

import { checkEvidenceFile, sanitizeFilename } from "@/features/evidence/files";
import { answersFromForm, rubricPercent, type Question } from "@/features/training/types";
import { parseLocalDateTime, toDateTimeLocal } from "@/lib/format";
import { caseSchema, iocSchema } from "@/lib/validation";

const enc = (s: string) => new TextEncoder().encode(s);

describe("evidence upload checks", () => {
  it("accepts allowed files whose content matches the extension", () => {
    expect(checkEvidenceFile("report.pdf", 10, enc("%PDF-1.7 ...")).ok).toBe(true);
    expect(checkEvidenceFile("notes.txt", 5, enc("hello")).ok).toBe(true);
  });
  it("rejects executables, disguised files and oversize files", () => {
    expect(checkEvidenceFile("payload.exe", 10, enc("MZ")).ok).toBe(false);
    expect(checkEvidenceFile("page.html", 10, enc("<html>")).ok).toBe(false);
    expect(checkEvidenceFile("fake.pdf", 10, enc("MZ\u0000\u0000")).ok).toBe(false);
    expect(checkEvidenceFile("big.txt", 21 * 1024 * 1024, enc("a")).ok).toBe(false);
    expect(checkEvidenceFile("empty.txt", 0, enc("")).ok).toBe(false);
  });
  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../../etc/pass wd?.txt")).toBe("etc_pass_wd_.txt");
    expect(sanitizeFilename("Fattura n°1.pdf")).toMatch(/^Fattura_n/);
  });
});

describe("schemas", () => {
  it("validates cases", () => {
    expect(caseSchema.safeParse({ title: "ab", category: "osint_investigation" }).success).toBe(false);
    const ok = caseSchema.parse({ title: "Indagine", category: "phishing_investigation", assigned_to: "" });
    expect(ok.status).toBe("open");
    expect(ok.assigned_to).toBeUndefined();
  });
  it("validates and normalises IOC against their type", () => {
    expect(iocSchema.safeParse({ indicator_type: "ipv4", indicator_value: "999.1.1.1" }).success).toBe(false);
    expect(iocSchema.parse({ indicator_type: "domain", indicator_value: "Evil[.]Example" }).indicator_value).toBe("evil.example");
  });
});

describe("Europe/Rome datetime handling", () => {
  it("round-trips datetime-local values in Italian time (winter and summer)", () => {
    expect(parseLocalDateTime("2026-01-15T10:30").toISOString()).toBe("2026-01-15T09:30:00.000Z");
    expect(parseLocalDateTime("2026-07-15T10:30").toISOString()).toBe("2026-07-15T08:30:00.000Z");
    expect(toDateTimeLocal("2026-07-15T08:30:00.000Z")).toBe("2026-07-15T10:30");
  });
});

describe("training helpers", () => {
  const questions: Question[] = [
    { id: "q1", type: "single", prompt: "", options: [{ value: "a", label: "" }, { value: "b", label: "" }] },
    { id: "q2", type: "multi", prompt: "", options: [{ value: "x", label: "" }, { value: "y", label: "" }] },
    { id: "q3", type: "keywords", prompt: "" },
  ];
  it("keeps only valid option values", () => {
    const fd = new FormData();
    fd.set("q_q1", "zzz");
    fd.append("q_q2", "x");
    fd.append("q_q2", "evil");
    fd.set("q_q3", "SPF fail");
    const answers = answersFromForm(questions, (k) => fd.get(k) as string | null, (k) => fd.getAll(k) as string[]);
    expect(answers).toEqual({ q2: ["x"], q3: "SPF fail" });
  });
  it("computes the weighted self-assessment", () => {
    const rubric = [
      { id: "a", criterion: "", description: "", weight: 50 },
      { id: "b", criterion: "", description: "", weight: 50 },
    ];
    expect(rubricPercent(rubric, {})).toBeNull();
    expect(rubricPercent(rubric, { a: 4, b: 2 })).toBe(75);
  });
});
