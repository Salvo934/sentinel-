"use client";

import { CopyPlus, FileDown, Loader2, Lock, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/common/confirm-action";
import { Button } from "@/components/ui/button";
import { CLASSIFICATIONS, CONFIDENCE, REPORT_TYPES, type Classification, type Confidence, type ReportType } from "@/lib/domain";
import { createClient } from "@/lib/supabase/client";
import { REPORT_SECTIONS } from "@/lib/validation";

import { attachReportPdfAction, deleteReportAction, finalizeReportAction, newReportVersionAction } from "../actions";
import type { ReportBundle } from "../data";
import { buildPdf, slugify, type PdfSection } from "../pdf";

export function buildReportPdf(bundle: ReportBundle) {
  const { report, caseInfo, analyst, annexes } = bundle;
  const c = report.content;
  const text = (key: string, heading: string): PdfSection => ({ kind: "text", heading, text: c[key] });
  const confidence = c.confidence ? CONFIDENCE[c.confidence as Confidence] : null;
  return buildPdf({
    platform: "Sentinel Intelligence",
    subtitle: REPORT_TYPES[report.report_type as ReportType],
    title: report.title,
    classification: CLASSIFICATIONS[report.classification as Classification],
    meta: [
      ["Identificativo del caso", `${caseInfo.case_ref} — ${caseInfo.title}`],
      ["Tipologia del caso", caseInfo.category],
      ["Analista", analyst],
      ["Data di creazione", new Date(report.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })],
      ["Versione", `v${report.version} (${report.status === "final" ? "finale" : "bozza"})`],
      ["Classificazione interna", CLASSIFICATIONS[report.classification as Classification]],
    ],
    sections: [
      text("executive_summary", "Executive Summary"),
      text("objective", "Obiettivo investigativo"),
      text("methodology", "Metodologia"),
      ...annexes
        .filter((a) => a.heading === "Fonti consultate" || a.heading === "Evidenze")
        .map((a): PdfSection => ({ kind: "table", heading: a.heading, head: a.head, rows: a.rows, note: a.note })),
      text("analysis", "Analisi"),
      text("risk_assessment", "Valutazione del rischio"),
      { kind: "text", heading: "Livello di confidenza", text: confidence ? `Confidenza ${confidence.toLowerCase()} (valutazione dell'analista).` : null },
      text("conclusions", "Conclusioni"),
      text("recommendations", "Raccomandazioni"),
      text("limitations", "Limitazioni"),
      ...annexes
        .filter((a) => a.heading !== "Fonti consultate" && a.heading !== "Evidenze")
        .map((a): PdfSection => ({ kind: "table", heading: `Allegato — ${a.heading}`, head: a.head, rows: a.rows, note: a.note })),
      { kind: "text", heading: "Allegati (note)", text: c.attachments, emptyText: "Nessuna nota sugli allegati." },
    ],
    footerNote:
      "Generato da Sentinel Intelligence esclusivamente con dati presenti nel database o inseriti dall'analista. Le sezioni non compilate sono indicate come tali.",
  });
}

export function ExportReportButton({ bundle, canStore }: { bundle: ReportBundle; canStore: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const pdf = buildReportPdf(bundle);
          const filename = `${bundle.caseInfo.case_ref}-${slugify(bundle.report.title)}-v${bundle.report.version}.pdf`;
          pdf.save(filename);
          if (!canStore) return;
          const supabase = createClient();
          const path = `${bundle.caseInfo.organization_id}/${bundle.caseInfo.id}/${bundle.report.id}-v${bundle.report.version}-${Date.now()}.pdf`;
          const { error } = await supabase.storage
            .from("investigation-reports")
            .upload(path, pdf.output("blob"), { contentType: "application/pdf", upsert: false });
          if (error) {
            toast.error("PDF scaricato, ma non è stato possibile archiviarlo su Supabase Storage.");
            return;
          }
          const res = await attachReportPdfAction(bundle.report.id, path);
          if (res.ok) toast.success("PDF esportato e archiviato nel bucket privato dei report.");
          else toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <FileDown />} Esporta PDF
    </Button>
  );
}

export function FinalizeReportButton({ reportId }: { reportId: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline" size="sm">
          <Lock /> Finalizza versione
        </Button>
      }
      title="Finalizzare questa versione?"
      description="Una versione finale non è più modificabile. Per apportare correzioni dovrai creare una nuova versione."
      confirmLabel="Finalizza"
      onConfirm={() => finalizeReportAction(reportId)}
      successMessage="Versione finalizzata"
    />
  );
}

export function NewVersionButton({ reportKey }: { reportKey: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => void (await newReportVersionAction(reportKey)))}>
      {pending ? <Loader2 className="animate-spin" /> : <CopyPlus />} Nuova versione
    </Button>
  );
}

export function DeleteReportButton({ reportId }: { reportId: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm">
          <Trash2 /> Elimina
        </Button>
      }
      title="Eliminare questa versione del report?"
      description="L'operazione è irreversibile e viene registrata nell'audit log."
      confirmLabel="Elimina"
      destructive
      onConfirm={() => deleteReportAction(reportId)}
    />
  );
}

export const SECTION_LABELS = REPORT_SECTIONS;
