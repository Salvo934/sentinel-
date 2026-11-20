import { describe, expect, it } from "vitest";

import { buildPdf, NOT_PROVIDED, toPdfText } from "@/features/reports/pdf";

describe("PDF builder", () => {
  it("maps unsupported characters for WinAnsi fonts", () => {
    expect(toPdfText("a → b ≥ c — «d» €")).toBe("a -> b >= c — «d» €");
  });
  it("builds a multi-section document without inventing content", () => {
    const pdf = buildPdf({
      platform: "Sentinel Intelligence",
      title: "Test",
      classification: "Uso interno",
      meta: [["Caso", "SI-2026-0001"]],
      sections: [
        { kind: "text", heading: "Executive Summary", text: "" },
        { kind: "table", heading: "Evidenze", head: ["A"], rows: [] },
        { kind: "table", heading: "IOC", head: ["Tipo", "Valore"], rows: [["IPv4", "203.0.113[.]1"]] },
      ],
    });
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(NOT_PROVIDED).toMatch(/non compilata/);
  });
});
