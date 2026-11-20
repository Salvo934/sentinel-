"use client";

import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildPdf } from "@/features/reports/pdf";

export type PortfolioEntry = {
  title: string;
  skills: string[];
  completedAt: string;
  score: number;
  maxScore: number;
  rubric: number | null;
  deliverable: string;
};

/** Exportable portfolio of completed exercises (formative results, not certifications). */
export function PortfolioButton({ analyst, entries }: { analyst: string; entries: PortfolioEntry[] }) {
  return (
    <Button
      variant="outline"
      disabled={entries.length === 0}
      onClick={() => {
        const pdf = buildPdf({
          platform: "Sentinel Intelligence",
          subtitle: "Training Academy — Portfolio",
          title: `Portfolio delle esercitazioni di ${analyst}`,
          classification: "Uso personale",
          meta: [
            ["Analista", analyst],
            ["Esercitazioni completate", String(entries.length)],
            ["Generato il", new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })],
          ],
          sections: [
            {
              kind: "table",
              heading: "Riepilogo",
              head: ["Esercitazione", "Competenze", "Completata", "Domande", "Autovalutazione"],
              rows: entries.map((e) => [
                e.title,
                e.skills.join(", "),
                new Date(e.completedAt).toLocaleDateString("it-IT"),
                `${e.score}/${e.maxScore}`,
                e.rubric !== null ? `${e.rubric}%` : "—",
              ]),
              note: "Punteggi formativi generati in un ambiente di esercitazione con scenari fittizi: non costituiscono certificazioni professionali riconosciute.",
            },
            ...entries.map((e) => ({ kind: "text" as const, heading: `Elaborato — ${e.title}`, text: e.deliverable })),
          ],
          footerNote: "Portfolio formativo generato da Sentinel Intelligence. Scenari e dati interamente fittizi.",
        });
        pdf.save("sentinel-portfolio.pdf");
      }}
    >
      <FileDown /> Esporta portfolio PDF
    </Button>
  );
}
