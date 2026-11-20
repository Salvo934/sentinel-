import { ActionForm, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { FormField, SelectInput, TextArea, TextInput } from "@/components/forms/fields";
import type { CaseRow, Member } from "@/features/cases/data";
import { ORG_ROLES, options, type OrgRole } from "@/lib/domain";

export function CaseForm({
  action,
  members,
  initial,
  submitLabel,
  successMessage,
}: {
  action: FormAction;
  members: Member[];
  initial?: Partial<CaseRow>;
  submitLabel: string;
  successMessage?: string;
}) {
  const memberOptions = members.map(
    (m) => [m.user_id, `${m.full_name ?? "Utente"} (${ORG_ROLES[m.role as OrgRole] ?? m.role})`] as const,
  );
  return (
    <ActionForm action={action} successMessage={successMessage} className="grid gap-4 md:grid-cols-2">
      <FormField label="Titolo" htmlFor="title" required className="md:col-span-2">
        <TextInput name="title" defaultValue={initial?.title} required maxLength={200} placeholder="Es. Verifica dominio sosia del brand" />
      </FormField>
      <FormField label="Tipologia" htmlFor="category" required>
        <SelectInput name="category" options={options.categories} defaultValue={initial?.category ?? "osint_investigation"} />
      </FormField>
      <FormField label="Analista responsabile" htmlFor="assigned_to">
        <SelectInput name="assigned_to" options={memberOptions} defaultValue={initial?.assigned_to} placeholder="— Nessuno —" />
      </FormField>
      <FormField label="Stato" htmlFor="status">
        <SelectInput name="status" options={options.statuses} defaultValue={initial?.status ?? "open"} />
      </FormField>
      <FormField label="Priorità" htmlFor="priority">
        <SelectInput name="priority" options={options.priorities} defaultValue={initial?.priority ?? "medium"} />
      </FormField>
      <FormField
        label="Livello di rischio"
        htmlFor="risk_level"
        hint="Valutazione professionale dell'analista, non un punteggio automatico."
      >
        <SelectInput name="risk_level" options={options.risks} defaultValue={initial?.risk_level ?? "informational"} />
      </FormField>
      <div className="hidden md:block" />
      <FormField label="Obiettivo investigativo" htmlFor="objective" className="md:col-span-2">
        <TextArea name="objective" rows={2} defaultValue={initial?.objective ?? ""} placeholder="Quale domanda deve risolvere l'indagine?" />
      </FormField>
      <FormField label="Descrizione" htmlFor="description" className="md:col-span-2">
        <TextArea name="description" rows={4} defaultValue={initial?.description ?? ""} />
      </FormField>
      <FormField label="Note" htmlFor="notes" className="md:col-span-2">
        <TextArea name="notes" rows={3} defaultValue={initial?.notes ?? ""} />
      </FormField>
      <div className="md:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
