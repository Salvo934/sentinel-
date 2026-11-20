import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/** Shows server-side Zod field errors on the matching React Hook Form fields. */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string[] | undefined> | undefined,
) {
  if (!fieldErrors) return;
  for (const [field, messages] of Object.entries(fieldErrors)) {
    const message = messages?.[0];
    if (message) setError(field as Path<T>, { type: "server", message });
  }
}
