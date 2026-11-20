import type { Metadata } from "next";

import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FormField, SelectInput, TextInput } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getCaseOptions } from "@/features/cases/data";
import { createReportAction } from "@/features/reports/actions";
import { options } from "@/lib/domain";
import { requireActiveOrg } from "@/lib/org";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Nuovo report" };

export default async function NewReportPage({ searchParams }: PageProps<"/reports/new">) {
  const { active } = await requireActiveOrg();
  const caseId = firstParam((await searchParams).case);
  const cases = await getCaseOptions(active.organizationId);
  return (
    <div className="space-y-6">
      <PageHeader title="Nuovo report" back={{ href: "/reports", label: "Reports" }} description="Il report nasce come bozza. Gli allegati (evidenze, fonti, IOC, cronologia) sono generati automaticamente dai dati del caso." />
      <Card>
        <CardContent>
          <ActionForm action={createReportAction} className="grid gap-4 md:grid-cols-2">
            <FormField label="Caso" htmlFor="case_id" required className="md:col-span-2">
              <SelectInput name="case_id" options={cases} defaultValue={caseId} placeholder="Seleziona un caso" />
            </FormField>
            <FormField label="Tipologia di report" htmlFor="report_type" required>
              <SelectInput name="report_type" options={options.reportTypes} defaultValue="osint_investigation" />
            </FormField>
            <FormField label="Classificazione interna" htmlFor="classification">
              <SelectInput name="classification" options={options.classifications} defaultValue="internal" />
            </FormField>
            <FormField label="Titolo" htmlFor="title" required className="md:col-span-2">
              <TextInput name="title" required />
            </FormField>
            <div className="md:col-span-2">
              <SubmitButton>Crea bozza</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
