import "server-only";

import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";

/** FormData → plain object (repeated keys become arrays). */
export function formToObject(formData: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || key.startsWith("$ACTION")) continue;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return out;
}

export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): { ok: true; data: z.output<T> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(formToObject(formData));
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors = z.flattenError(parsed.error).fieldErrors as Record<string, string[]>;
  const formErrors = z.flattenError(parsed.error).formErrors;
  return {
    ok: false,
    result: fail(formErrors[0] ?? "Controlla i campi del modulo.", Object.keys(fieldErrors).length ? fieldErrors : undefined),
  };
}

type DbError = { code?: string; message?: string } | null | undefined;

/**
 * Maps database errors to user-facing messages without leaking internals
 * (table names, constraint names, SQL). Details go to the server log.
 */
export function dbFail(error: DbError, context: string): ActionResult<never> {
  console.error(`[db] ${context}:`, error?.code, error?.message);
  switch (error?.code) {
    case "42501":
      return fail("Operazione non autorizzata per il tuo ruolo o per lo stato dell'elemento.");
    case "23505":
      return fail("Esiste già un elemento con questi dati.");
    case "23514":
      return fail("I dati non rispettano i vincoli di integrità previsti.");
    case "23503":
      return fail("L'elemento collegato non esiste o non è accessibile.");
    case "P0002":
      return fail("Elemento non trovato.");
    case "22P02":
      return fail("Formato dei dati non valido.");
    default:
      return fail("Si è verificato un errore durante il salvataggio. Riprova.");
  }
}

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
