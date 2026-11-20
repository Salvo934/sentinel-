"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

export type FormAction = (prev: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown>>;

/**
 * Progressive-enhancement form bound to a Server Action.
 * Shows the action's error, field errors (via context-free `data-error`), and
 * a toast on success.
 */
export function ActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (successMessage) toast.success(successMessage);
      if (resetOnSuccess) ref.current?.reset();
    }
  }, [state, successMessage, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className} noValidate>
      {state && !state.ok ? (
        <FormAlert tone="error" className="mb-3">
          {state.error}
          {state.fieldErrors ? (
            <ul className="mt-1 list-disc pl-4 text-xs">
              {Object.entries(state.fieldErrors).map(([field, messages]) => (
                <li key={field}>{messages.join(", ")}</li>
              ))}
            </ul>
          ) : null}
        </FormAlert>
      ) : null}
      {children}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "default",
  size = "default",
  className,
  name,
  value,
}: {
  children: ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "xs";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={className} name={name} value={value}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}
