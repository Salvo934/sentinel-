import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoBadge } from "@/components/common/badges";
import { ToneBadge } from "@/components/common/tone-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FormField, SelectInput, TextArea, TextInput } from "@/components/forms/fields";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveReportAction } from "@/features/reports/actions";
import { DeleteReportButton, ExportReportButton, FinalizeReportButton, NewVersionButton } from "@/features/reports/components/report-actions";
import { getReportBundle } from "@/features/reports/data";
import { CLASSIFICATIONS, CONFIDENCE, REPORT_TYPES, options, type Classification, type Confidence, type ReportType } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { REPORT_SECTIONS } from "@/lib/validation";

export const metadata: Metadata = { title: "Report" };

const HINTS: Record<string, string> = {
  executive_summary: "Sintesi per il decisore: cosa è emerso, quanto è affidabile, cosa fare.",
  methodology: "Fonti, strumenti e metodi utilizzati; criteri di valutazione (es. scala Admiralty).",
  analysis: "Interpretazione dei dati. Distingui esplicitamente fatti verificati e ipotesi.",
  risk_assessment: "Valutazione professionale motivata (non un punteggio automatico).",
  limitations: "Cosa non è stato possibile verificare, lacune delle fonti, vincoli.",
};

export default async function ReportPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const { active, user } = await requireActiveOrg();
  const bundle = await getReportBundle(id);
  if (!bundle) notFound();
  const { report, caseInfo, annexes, versions, analyst } = bundle;
  const caseWritable = caseInfo.status !== "archived" && (active.role !== "trainee" || report.created_by === user.id);
  const editable = report.status === "draft" && caseWritable;
  const latest = versions[0]?.id === report.id;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/reports", label: "Reports" }}
        eyebrow={REPORT_TYPES[report.report_type as ReportType]}
        title={report.title}
        description={
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <ToneBadge tone={report.status === "final" ? "success" : "info"}>
              v{report.version} · {report.status === "final" ? "Finale" : "Bozza"}
            </ToneBadge>
            <ToneBadge tone="neutral">{CLASSIFICATIONS[report.classification as Classification]}</ToneBadge>
            <DemoBadge show={report.is_demo} />
            <Link href={`/investigations/${caseInfo.id}?tab=reports`} className="text-xs underline">
              {caseInfo.case_ref} · {caseInfo.title}
            </Link>
          </div>
        }
        actions={
          <>
            <ExportReportButton bundle={bundle} canStore={caseWritable} />
            {report.storage_path ? (
              <Button asChild size="sm" variant="outline">
                <a href={`/reports/${report.id}/download`}>
                  <Download /> PDF archiviato
                </a>
              </Button>
            ) : null}
            {editable ? <FinalizeReportButton reportId={report.id} /> : null}
            {report.status === "final" && latest && caseWritable ? <NewVersionButton reportKey={report.report_key} /> : null}
            {(report.status === "draft" && caseWritable) || active.role === "admin" ? <DeleteReportButton reportId={report.id} /> : null}
          </>
        }
      />

      {report.status === "final" ? (
        <FormAlert tone="info">
          Versione finale del {report.finalized_at ? formatDateTime(report.finalized_at) : "—"}: non modificabile. Crea una nuova versione per apportare correzioni.
        </FormAlert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editable ? "Contenuto del report" : "Anteprima"}</CardTitle>
            <CardDescription>Le sezioni lasciate vuote saranno indicate nel PDF come «non compilate»: nulla viene generato automaticamente.</CardDescription>
          </CardHeader>
          <CardContent>
            {editable ? (
              <ActionForm action={saveReportAction.bind(null, report.id)} successMessage="Bozza salvata" className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_200px_200px]">
                  <FormField label="Titolo" htmlFor="title" required>
                    <TextInput name="title" defaultValue={report.title} />
                  </FormField>
                  <FormField label="Classificazione" htmlFor="classification">
                    <SelectInput name="classification" options={options.classifications} defaultValue={report.classification} />
                  </FormField>
                  <FormField label="Livello di confidenza" htmlFor="confidence">
                    <SelectInput name="confidence" options={options.confidence} defaultValue={report.content.confidence} placeholder="Non indicato" />
                  </FormField>
                </div>
                {REPORT_SECTIONS.map((s) => (
                  <FormField key={s.key} label={s.label} htmlFor={s.key} hint={HINTS[s.key]}>
                    <TextArea name={s.key} rows={s.key === "analysis" ? 8 : 4} defaultValue={report.content[s.key] ?? ""} />
                  </FormField>
                ))}
                <div className="sticky bottom-0 -mx-4 border-t bg-card/95 px-4 py-3 backdrop-blur">
                  <SubmitButton>Salva bozza</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <article className="space-y-4 text-sm">
                {REPORT_SECTIONS.map((s) => (
                  <section key={s.key}>
                    <h3 className="font-semibold">{s.label}</h3>
                    <p className={report.content[s.key] ? "whitespace-pre-wrap" : "text-muted-foreground italic"}>
                      {report.content[s.key] || "[Sezione non compilata dall'analista]"}
                    </p>
                  </section>
                ))}
                <section>
                  <h3 className="font-semibold">Livello di confidenza</h3>
                  <p>{report.content.confidence ? CONFIDENCE[report.content.confidence as Confidence] : "Non indicato"}</p>
                </section>
              </article>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Intestazione</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <p>
                <span className="text-muted-foreground">Piattaforma:</span> Sentinel Intelligence
              </p>
              <p>
                <span className="text-muted-foreground">Caso:</span> {caseInfo.case_ref} ({caseInfo.category})
              </p>
              <p>
                <span className="text-muted-foreground">Analista:</span> {analyst}
              </p>
              <p>
                <span className="text-muted-foreground">Creato:</span> {formatDateTime(report.created_at)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Allegati generati dal database</CardTitle>
              <CardDescription>Aggiornati a ogni esportazione con i dati correnti del caso.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {annexes.map((a) => (
                <div key={a.heading} className="flex justify-between border-b py-1 last:border-0">
                  <span>{a.heading}</span>
                  <span className="text-muted-foreground tabular-nums">{a.rows.length}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Versioni</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between">
                    <Link href={`/reports/${v.id}`} className={v.id === report.id ? "font-semibold" : "underline"}>
                      v{v.version}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {v.status === "final" ? "finale" : "bozza"} · {formatDateTime(v.updated_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
