import { describe, expect, it } from "vitest";

import { analyzeEmail, parseAddress, registrableDomain } from "@/features/phishing/parser";
import { PHISHING_SAMPLES } from "@/features/phishing/samples";

const sample = (key: string) => PHISHING_SAMPLES.find((s) => s.key === key)!.raw;

describe("phishing parser", () => {
  it("parses addresses", () => {
    expect(parseAddress('"Mario" <Mario@Example.com>')).toEqual({ display: "Mario", address: "mario@example.com", domain: "example.com" });
    expect(parseAddress("plain@x.example")?.domain).toBe("x.example");
  });

  it("computes registrable domains", () => {
    expect(registrableDomain("a.b.example.com")).toBe("example.com");
    expect(registrableDomain("shop.example.co.uk")).toBe("example.co.uk");
  });

  it("analyses the fake courier training sample", () => {
    const a = analyzeEmail(sample("fake-courier"));
    expect(a.auth).toMatchObject({ spf: "softfail", dkim: "fail", dmarc: "fail", dkimDomain: "bulkmail-sender.example" });
    expect(a.from.address).toBe("notifiche@spedirapido.example");
    expect(a.replyTo?.domain).toBe("spedirapido-supporto.example");
    expect(a.ips).toEqual(["198.51.100.77"]);
    const ids = a.findings.map((f) => f.id);
    expect(ids).toContain("reply-to");
    expect(ids).toContain("return-path");
    expect(ids).toContain("urgency");
    expect(a.urls[0]).toMatchObject({ host: "spedirapido.tracking-update.example", mismatch: true });
    expect(a.attachments[0]).toMatchObject({ filename: "Ricevuta_Spedizione.pdf.html", risky: true });
    // High severity findings come first.
    expect(a.findings[0]!.severity).toBe("high");
  });

  it("flags BEC reply-to on free webmail even when authentication passes", () => {
    const a = analyzeEmail(sample("bec"));
    expect(a.auth.spf).toBe("pass");
    expect(a.findings.map((f) => f.id)).toContain("reply-freemail");
    expect(a.findings.map((f) => f.id)).toContain("sensitive");
  });

  it("flags IP-literal links and shorteners", () => {
    const a = analyzeEmail(sample("credential-harvest"));
    const ids = a.findings.map((f) => f.id);
    expect(ids.some((i) => i.startsWith("link-ip-"))).toBe(true);
    expect(ids.some((i) => i.startsWith("link-short-"))).toBe(true);
  });

  it("never returns clickable URLs in defanged form and handles empty input", () => {
    for (const s of PHISHING_SAMPLES) {
      for (const u of analyzeEmail(s.raw).urls) expect(u.defanged).not.toMatch(/^https?:\/\//);
    }
    const empty = analyzeEmail("");
    expect(empty.findings.every((f) => f.severity === "info")).toBe(true);
  });

  it("unfolds multi-line headers", () => {
    const a = analyzeEmail("Subject: first\n  second\nFrom: a@b.example\n\nbody");
    expect(a.subject).toBe("first second");
  });
});
