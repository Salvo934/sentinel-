import { ActionForm, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { FormField, SelectInput, TextArea, TextInput } from "@/components/forms/fields";
import type { EventRow } from "@/features/cases/data";
import { options } from "@/lib/domain";
import { toDateTimeLocal } from "@/lib/format";

export function EventForm({
  action,
  evidenceOptions,
  initial,
  submitLabel,
  idPrefix = "ev",
}: {
  action: FormAction;
  evidenceOptions: (readonly [string, string])[];
  initial?: Partial<EventRow>;
  submitLabel: string;
  idPrefix?: string;
}) {
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <ActionForm action={action} successMessage="Evento salvato" resetOnSuccess={!initial} className="grid gap-3 md:grid-cols-2">
      <FormField label="Titolo" htmlFor={id("title")} required className="md:col-span-2">
        <TextInput id={id("title")} name="title" defaultValue={initial?.title} required />
      </FormField>
      <FormField label="Data e ora dell'evento" htmlFor={id("event_at")} required hint="Quando l'evento è avvenuto (ora italiana).">
        <TextInput id={id("event_at")} name="event_at" type="datetime-local" defaultValue={toDateTimeLocal(initial?.event_at)} required />
      </FormField>
      <FormField label="Data di acquisizione" htmlFor={id("recorded_at")} hint="Quando l'analista ne è venuto a conoscenza (vuoto = adesso).">
        <TextInput id={id("recorded_at")} name="recorded_at" type="datetime-local" defaultValue={toDateTimeLocal(initial?.recorded_at)} />
      </FormField>
      <FormField label="Categoria" htmlFor={id("category")}>
        <SelectInput id={id("category")} name="category" options={options.eventCategories} defaultValue={initial?.category ?? "other"} />
      </FormField>
      <FormField label="Fonte" htmlFor={id("source")}>
        <TextInput id={id("source")} name="source" defaultValue={initial?.source ?? ""} />
      </FormField>
      <FormField label="Affidabilità della fonte" htmlFor={id("reliability")}>
        <SelectInput id={id("reliability")} name="reliability" options={options.reliability} defaultValue={initial?.reliability ?? "F"} />
      </FormField>
      <FormField label="Stato dell'informazione" htmlFor={id("info_status")}>
        <SelectInput id={id("info_status")} name="info_status" options={options.infoStatuses} defaultValue={initial?.info_status ?? "to_verify"} />
      </FormField>
      <FormField label="Evidenza collegata" htmlFor={id("evidence_id")} className="md:col-span-2">
        <SelectInput id={id("evidence_id")} name="evidence_id" options={evidenceOptions} defaultValue={initial?.evidence_id} placeholder="— Nessuna —" />
      </FormField>
      <FormField label="Descrizione" htmlFor={id("description")} className="md:col-span-2">
        <TextArea id={id("description")} name="description" rows={2} defaultValue={initial?.description ?? ""} />
      </FormField>
      <div className="md:col-span-2">
        <SubmitButton size="sm">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
