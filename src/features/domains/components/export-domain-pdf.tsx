"use client";

import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildPdf, slugify } from "@/features/reports/pdf";
import { RISK_LEVELS, type RiskLevel } from "@/lib/domain";

export type SavedDomainAnalysis = {
  id: string;
  domain: string;
  data_mode: string;
  dns: Record<string, unknown>;
  rdap: Record<string, unknown> | null;
  anomalies: string[];
  analyst_notes: string | null;
  risk_level: RiskLevel | null;
  risk_rationale: string | null;
  created_at: string;
  case_ref: string | null;
  analyst: string;
};

export function ExportDomainPdfButton({ analysis }: { analysis: SavedDomainAnalysis }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        const dnsRows = ["A", "AAAA", "MX", "NS", "TXT", "DMARC"].map((k) => [k, ((analysis.dns[k] as string[]) ?? []).join("\n") || "—"]);
        const rdap = analysis.rdap ?? {};
        const pdf = buildPdf({
          platform: "Sentinel Intelligence",
          subtitle: "Domain Investigation",
          title: `Analisi del dominio ${analysis.domain}`,
          classification: "Uso interno",
          meta: [
            ["Dominio", analysis.domain],
            ["Modalità dati", analysis.data_mode === "live" ? "Raccolta reale passiva (DNS/RDAP)" : "Dati simulati (dominio riservato)"],
            ["Data di raccolta", new Date(analysis.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })],
            ["Analista", analysis.analyst],
            ["Caso collegato", analysis.case_ref ?? "—"],
          ],
          sections: [
            { kind: "table", heading: "Record DNS", head: ["Tipo", "Valori"], rows: dnsRows },
            {
              kind: "table",
              heading: "Dati RDAP",
              head: ["Campo", "Valore"],
              rows: Object.entries(rdap).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v ?? "—")]),
              emptyText: "Dati RDAP non disponibili.",
            },
            { kind: "table", heading: "Osservazioni automatiche", head: ["Osservazione"], rows: analysis.anomalies.map((a) => [a]), emptyText: "Nessuna osservazione automatica." },
            {
              kind: "text",
              heading: "Valutazione del rischio (analista)",
              text: analysis.risk_level ? `${RISK_LEVELS[analysis.risk_level]}. ${analysis.risk_rationale ?? ""}` : null,
            },
            { kind: "text", heading: "Note dell'analista", text: analysis.analyst_notes },
            {
              kind: "text",
              heading: "Limitazioni",
              text: "Fotografia al momento della raccolta. Il dominio non è stato visitato né scansionato. La valutazione del rischio è un giudizio professionale e non una certificazione.",
            },
          ],
        });
        pdf.save(`domain-${slugify(analysis.domain)}.pdf`);
      }}
    >
      <FileDown /> PDF
    </Button>
  );
}
