/**
 * Generic professional PDF document builder (jsPDF + autotable).
 * Pure layout: it prints only the content it receives, never fills gaps.
 */
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const REPLACEMENTS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "≥": ">=",
  "≤": "<=",
  " ": " ",
  " ": " ",
  "​": "",
  "−": "-",
};

/** Standard PDF fonts are WinAnsi (cp1252): map the few unsupported symbols. */
export function toPdfText(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if ((code <= 0xff && (code < 0x80 || code > 0x9f)) || CP1252_EXTRA.has(ch)) out += ch;
    else out += REPLACEMENTS[ch] ?? "?";
  }
  return out;
}

type RGB = [number, number, number];
const NAVY: RGB = [18, 38, 66];
const TEAL: RGB = [20, 120, 125];
const INK: RGB = [30, 34, 44];
const MUTED: RGB = [105, 112, 128];
const LINE: RGB = [215, 221, 232];

export type PdfSection =
  | { kind: "text"; heading: string; text: string | null | undefined; emptyText?: string }
  | { kind: "table"; heading: string; head: string[]; rows: string[][]; emptyText?: string; note?: string };

export type PdfDocument = {
  platform: string;
  title: string;
  subtitle?: string;
  classification: string;
  meta: [string, string][];
  sections: PdfSection[];
  footerNote?: string;
};

export const NOT_PROVIDED = "[Sezione non compilata dall'analista]";

export function buildPdf(doc: PdfDocument): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 16;
  const contentW = W - M * 2;
  let y = 0;

  const header = () => {
    pdf.setFillColor(...NAVY);
    pdf.rect(0, 0, W, 12, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text(toPdfText(doc.platform.toUpperCase()), M, 7.8);
    pdf.text(toPdfText(`CLASSIFICAZIONE: ${doc.classification.toUpperCase()}`), W - M, 7.8, { align: "right" });
  };
  const ensure = (needed: number) => {
    if (y + needed > H - 18) {
      pdf.addPage();
      header();
      y = 22;
    }
  };

  // Cover block
  header();
  y = 26;
  pdf.setTextColor(...TEAL);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  if (doc.subtitle) {
    pdf.text(toPdfText(doc.subtitle.toUpperCase()), M, y);
    y += 6;
  }
  pdf.setTextColor(...INK);
  pdf.setFontSize(18);
  const titleLines = pdf.splitTextToSize(toPdfText(doc.title), contentW) as string[];
  pdf.text(titleLines, M, y + 2);
  y += titleLines.length * 7.5 + 4;

  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M },
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 1.4, textColor: INK },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 48, textColor: MUTED } },
    body: doc.meta.map(([k, v]) => [toPdfText(k), toPdfText(v)]),
  });
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  pdf.setDrawColor(...LINE);
  pdf.line(M, y, W - M, y);
  y += 7;

  doc.sections.forEach((section, index) => {
    ensure(18);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11.5);
    pdf.setTextColor(...NAVY);
    pdf.text(toPdfText(`${index + 1}. ${section.heading}`), M, y);
    y += 6;

    if (section.kind === "text") {
      const value = section.text?.trim();
      pdf.setFont("helvetica", value ? "normal" : "italic");
      pdf.setFontSize(9.5);
      pdf.setTextColor(...(value ? INK : MUTED));
      const lines = pdf.splitTextToSize(toPdfText(value || section.emptyText || NOT_PROVIDED), contentW) as string[];
      for (const line of lines) {
        ensure(5);
        pdf.text(line, M, y);
        y += 4.6;
      }
      y += 4;
    } else {
      if (section.rows.length === 0) {
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(9.5);
        pdf.setTextColor(...MUTED);
        pdf.text(toPdfText(section.emptyText ?? "Nessun elemento registrato nel database."), M, y);
        y += 8;
      } else {
        autoTable(pdf, {
          startY: y,
          margin: { left: M, right: M, top: 20 },
          head: [section.head.map(toPdfText)],
          body: section.rows.map((r) => r.map((c) => toPdfText(c))),
          styles: { fontSize: 7.8, cellPadding: 1.6, textColor: INK, lineColor: LINE, lineWidth: 0.1, overflow: "linebreak" },
          headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [247, 249, 252] },
          didDrawPage: () => header(),
        });
        y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
        if (section.note) {
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(7.5);
          pdf.setTextColor(...MUTED);
          const lines = pdf.splitTextToSize(toPdfText(section.note), contentW) as string[];
          pdf.text(lines, M, y + 2);
          y += lines.length * 3.6 + 2;
        }
        y += 5;
      }
    }
  });

  // Footer on every page
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    const note = doc.footerNote ?? "Documento generato da Sentinel Intelligence con i soli dati presenti nel database o inseriti dall'analista.";
    pdf.text(pdf.splitTextToSize(toPdfText(note), contentW - 25) as string[], M, H - 10);
    pdf.text(`${i} / ${pages}`, W - M, H - 10, { align: "right" });
  }
  return pdf;
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
}
