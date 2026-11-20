import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FormField, SelectInput, TextArea } from "@/components/forms/fields";
import { options } from "@/lib/domain";

import { mapTechniqueAction } from "../actions";

/**
 * Maps a technique onto a case. Either the case or the technique can be fixed
 * (hidden field); the other is chosen. Default status is "hypothesis": the
 * analyst upgrades it only when an evidence supports it.
 */
export function MapTechniqueForm({
  caseId,
  techniqueId,
  caseOptions,
  techniqueOptions,
  evidenceOptions,
  source = "manual",
  defaultObservation,
  idPrefix = "map",
  compact = false,
}: {
  caseId?: string;
  techniqueId?: string;
  caseOptions?: (readonly [string, string])[];
  techniqueOptions?: (readonly [string, string])[];
  evidenceOptions?: (readonly [string, string])[];
  source?: "manual" | "phishing_lab" | "domain_analysis" | "attack_page";
  defaultObservation?: string;
  idPrefix?: string;
  compact?: boolean;
}) {
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <ActionForm action={mapTechniqueAction} successMessage="Tecnica mappata sul caso" resetOnSuccess className={compact ? "grid gap-2" : "grid gap-3 sm:grid-cols-2"}>
      <input type="hidden" name="source" value={source} />
      {caseId ? (
        <input type="hidden" name="case_id" value={caseId} />
      ) : (
        <FormField label="Caso" htmlFor={id("case")} required className="sm:col-span-2">
          <SelectInput id={id("case")} name="case_id" options={caseOptions ?? []} placeholder="Seleziona un caso" />
        </FormField>
      )}
      {techniqueId ? (
        <input type="hidden" name="technique_id" value={techniqueId} />
      ) : (
        <FormField label="Tecnica ATT&CK" htmlFor={id("tech")} required className="sm:col-span-2" hint="Scrivi l'ID o il nome (es. T1566.002, Spearphishing Link) e scegli dall'elenco.">
          <>
            <input
              id={id("tech")}
              name="technique_id"
              list={id("tech-list")}
              autoComplete="off"
              placeholder="T1566.002"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <datalist id={id("tech-list")}>
              {(techniqueOptions ?? []).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </datalist>
          </>
        </FormField>
      )}
      <FormField label="Stato dell'informazione" htmlFor={id("status")}>
        <SelectInput id={id("status")} name="info_status" options={options.infoStatuses} defaultValue="hypothesis" />
      </FormField>
      <FormField label="Confidenza" htmlFor={id("conf")}>
        <SelectInput id={id("conf")} name="confidence" options={options.confidence} defaultValue="low" />
      </FormField>
      {evidenceOptions?.length ? (
        <FormField label="Evidenza a supporto" htmlFor={id("ev")} className="sm:col-span-2">
          <SelectInput id={id("ev")} name="evidence_id" options={evidenceOptions} placeholder="— Nessuna —" />
        </FormField>
      ) : null}
      <FormField label="Osservazione" htmlFor={id("obs")} className="sm:col-span-2" hint="Cosa hai osservato che giustifica la tecnica?">
        <TextArea id={id("obs")} name="observation" rows={compact ? 2 : 3} defaultValue={defaultObservation} />
      </FormField>
      <div className="sm:col-span-2">
        <SubmitButton size="sm">Mappa sul caso</SubmitButton>
      </div>
    </ActionForm>
  );
}
