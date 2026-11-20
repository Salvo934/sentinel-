import { describe, expect, it } from "vitest";

import { computeAnomalies, EMPTY_DNS, isReservedDomain, simulatedReport } from "@/features/domains/model";
import { domainInputSchema } from "@/lib/validation";

const NOW = new Date("2026-11-20T10:00:00Z");

describe("domain analysis", () => {
  it("normalises domain input", () => {
    expect(domainInputSchema.parse(" HTTPS://Example.COM/path ")).toBe("example.com");
    expect(domainInputSchema.safeParse("localhost").success).toBe(false);
    expect(domainInputSchema.safeParse("a..b.com").success).toBe(false);
    expect(domainInputSchema.safeParse("http://10.0.0.1").success).toBe(false);
  });

  it("detects reserved domains", () => {
    expect(isReservedDomain("velora.example")).toBe(true);
    expect(isReservedDomain("example.com")).toBe(true);
    expect(isReservedDomain("lab.test")).toBe(true);
    expect(isReservedDomain("example.it")).toBe(false);
  });

  it("flags permissive SPF, missing DMARC and young registrations", () => {
    const anomalies = computeAnomalies(
      { ...EMPTY_DNS, A: ["203.0.113.1"], TXT: ["v=spf1 +all"] },
      { registrar: null, registration: "2026-11-14T00:00:00Z", expiration: null, lastChanged: null, status: [], nameservers: [], source: "t" },
      NOW,
    );
    expect(anomalies.join("|")).toMatch(/SPF permissivo/);
    expect(anomalies.join("|")).toMatch(/DMARC assente/);
    expect(anomalies.join("|")).toMatch(/registrato di recente \(6 giorni/);
    expect(anomalies.join("|")).toMatch(/Nessun record MX/);
  });

  it("produces clearly labelled simulated data", () => {
    const r = simulatedReport("velora-componenti-supporto.example", NOW);
    expect(r.dataMode).toBe("simulated");
    expect(r.limitations[0]).toMatch(/SIMULATI/);
    expect(r.anomalies.length).toBeGreaterThan(2);
    const legit = simulatedReport("velora-componenti.example", NOW);
    expect(legit.anomalies).toEqual([]);
  });
});
