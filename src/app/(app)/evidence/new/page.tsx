import type { Metadata } from "next";

import { FormAlert } from "@/components/forms/form-alert";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FormField, SelectInput, TextArea, TextInput } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getCaseOptions } from "@/features/cases/data";
import { createEvidenceAction } from "@/features/evidence/actions";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS } from "@/features/evidence/files";
import { options } from "@/lib/domain";
import { requireActiveOrg } from "@/lib/org";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Nuova evidenza" };

export default async function NewEvidencePage({ searchParams }: PageProps<"/evidence/new">) {
  const { active } = await requireActiveOrg();
  const caseId = firstParam((await searchParams).case);
  const cases = await getCaseOptions(active.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registra una nuova evidenza"
        back={caseId ? { href: `/investigations/${caseId}?tab=evidence`, label: "Torna al caso" } : { href: "/evidence", label: "Evidence Library" }}
        description="Il file viene archiviato in un bucket privato; l'hash SHA-256 è calcolato dal server sui byte effettivamente salvati."
      />
      <FormAlert tone="info">
        Carica solo materiale acquisito lecitamente e pertinente all&apos;indagine. Non caricare malware né eseguibili: sono
        ammessi solo {Object.keys(ALLOWED_EXTENSIONS).join(", ")} (max 20 MB). L&apos;archivio supporta l&apos;integrità tramite hash
        ma non garantisce di per sé i requisiti di catena di custodia o la validità probatoria.
      </FormAlert>
      <Card>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Crea prima un caso investigativo a cui collegare l&apos;evidenza.</p>
          ) : (
            <ActionForm action={createEvidenceAction} className="grid gap-4 md:grid-cols-2">
              <FormField label="Caso collegato" htmlFor="case_id" required className="md:col-span-2">
                <SelectInput name="case_id" options={cases} defaultValue={caseId} placeholder="Seleziona un caso" required />
              </FormField>
              <FormField label="Titolo" htmlFor="title" required>
                <TextInput name="title" required />
              </FormField>
              <FormField label="Tipologia" htmlFor="evidence_type">
                <SelectInput name="evidence_type" options={options.evidenceTypes} defaultValue="document" />
              </FormField>
              <FormField label="File (facoltativo)" htmlFor="file" className="md:col-span-2" hint="Il file non viene mai aperto né eseguito dalla piattaforma; il download avviene come allegato.">
                <TextInput name="file" type="file" accept={ACCEPT_ATTRIBUTE} />
              </FormField>
              <FormField label="Fonte" htmlFor="source">
                <TextInput name="source" placeholder="Es. Registro imprese, segnalazione interna" />
              </FormField>
              <FormField label="URL della fonte" htmlFor="source_url" hint="Solo come riferimento testuale: non viene visitato.">
                <TextInput name="source_url" type="url" placeholder="https://" />
              </FormField>
              <FormField label="Metodo di acquisizione" htmlFor="acquisition_method">
                <TextInput name="acquisition_method" placeholder="Es. esportazione .eml, screenshot manuale" />
              </FormField>
              <FormField label="Data di acquisizione" htmlFor="collected_at" hint="Vuoto = adesso">
                <TextInput name="collected_at" type="datetime-local" />
              </FormField>
              <FormField label="Affidabilità della fonte" htmlFor="reliability">
                <SelectInput name="reliability" options={options.reliability} defaultValue="F" />
              </FormField>
              <FormField label="Stato della verifica" htmlFor="verification_status">
                <SelectInput name="verification_status" options={options.infoStatuses} defaultValue="to_verify" />
              </FormField>
              <FormField label="Descrizione" htmlFor="description" className="md:col-span-2">
                <TextArea name="description" rows={3} />
              </FormField>
              <FormField label="Note" htmlFor="notes" className="md:col-span-2">
                <TextArea name="notes" rows={2} />
              </FormField>
              <div className="md:col-span-2">
                <SubmitButton>Registra evidenza</SubmitButton>
              </div>
            </ActionForm>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
