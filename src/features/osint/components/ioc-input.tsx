"use client";

import { useState } from "react";

import { FormField, TextInput } from "@/components/forms/fields";
import { IOC_TYPES, options, type IocType } from "@/lib/domain";
import { detectIndicatorType, isDocumentationIndicator, normalizeIndicator, validateIndicator } from "@/lib/indicators";

/** Value + type with live format validation and type auto-detection. */
export function IocInput() {
  const [value, setValue] = useState("");
  const [type, setType] = useState<IocType | "">("");
  const detected = value ? detectIndicatorType(value) : null;
  const effective = (type || detected || "") as IocType | "";
  const valid = effective && value ? validateIndicator(effective, value) : null;

  return (
    <>
      <FormField label="Indicatore" htmlFor="indicator_value" required className="md:col-span-2" hint="Puoi incollare valori defanged (hxxp, [.]): vengono normalizzati.">
        <TextInput
          name="indicator_value"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          placeholder="Es. 203.0.113.45, evil.example, hash SHA-256…"
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </FormField>
      <FormField label="Tipo" htmlFor="indicator_type" required>
        <select
          id="indicator_type"
          name="indicator_type"
          value={effective}
          onChange={(e) => setType(e.target.value as IocType)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30 [&>option]:bg-popover"
        >
          <option value="">Rilevamento automatico</option>
          {options.iocTypes.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </FormField>
      <div className="flex items-end pb-1 text-xs" aria-live="polite">
        {value ? (
          valid ? (
            <span className="text-success">
              Formato {IOC_TYPES[effective as IocType]} valido
              {isDocumentationIndicator(effective as IocType, normalizeIndicator(effective as IocType, value)) ? " · indirizzo/dominio di documentazione" : ""}
            </span>
          ) : (
            <span className="text-destructive">{effective ? "Formato non valido per il tipo selezionato" : "Tipo non riconosciuto"}</span>
          )
        ) : (
          <span className="text-muted-foreground">IPv4, IPv6, domini, URL, SHA-256, SHA-1, MD5</span>
        )}
      </div>
    </>
  );
}
