import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoBadge, VerdictBadge } from "@/components/common/badges";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FormField, SelectInput, TextArea } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCaseOptions } from "@/features/cases/data";
import { updatePhishingAssessmentAction } from "@/features/phishing/actions";
import { AnalysisView } from "@/features/phishing/components/analysis-view";
import { analyzeEmail } from "@/features/phishing/parser";
import { options, type Verdict } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Analisi phishing" };

export default async function PhishingDetailPage({ params }: PageProps<"/phishing/[id]">) {
  const { id } = await params;
  const { active } = await requireActiveOrg();
  const supabase = await createClient();
  const { data: a } = await supabase.from("phishing_analyses").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  const cases = await getCaseOptions(active.organizationId);
  // Re-derived from the stored raw message so the view is always complete.
  const analysis = analyzeEmail(a.raw_message as string);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/phishing", label: "Phishing Lab" }}
        title={a.title as string}
        description={
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <VerdictBadge value={a.verdict as Verdict} />
            <DemoBadge show={a.is_demo as boolean} />
            <span className="text-xs">Salvata il {formatDateTime(a.created_at as string)}</span>
            {a.case_id ? (
              <Link href={`/investigations/${a.case_id}`} className="text-xs underline">
                Caso collegato
              </Link>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Risultati</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalysisView analysis={analysis} />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Valutazione dell&apos;analista</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={updatePhishingAssessmentAction.bind(null, id)} successMessage="Valutazione aggiornata" className="grid gap-3">
                <FormField label="Verdetto" htmlFor="verdict">
                  <SelectInput name="verdict" options={options.verdicts} defaultValue={a.verdict as string} />
                </FormField>
                <FormField label="Confidenza" htmlFor="confidence">
                  <SelectInput name="confidence" options={options.confidence} defaultValue={a.confidence as string} />
                </FormField>
                <FormField label="Caso" htmlFor="case_id">
                  <SelectInput name="case_id" options={cases} defaultValue={a.case_id as string | null} placeholder="— Nessuno —" />
                </FormField>
                <FormField label="Valutazione motivata" htmlFor="analyst_assessment">
                  <TextArea name="analyst_assessment" rows={6} defaultValue={(a.analyst_assessment as string) ?? ""} />
                </FormField>
                <SubmitButton size="sm">Salva</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sorgente (testo)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-96 overflow-auto rounded-md bg-muted/50 p-3 text-[11px] whitespace-pre-wrap">{a.raw_message as string}</pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
