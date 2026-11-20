"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { mapAuthError } from "@/features/auth/errors";
import { forgotPasswordSchema } from "@/features/auth/schemas";
import { NOT_CONFIGURED_MESSAGE, tryCreateClient } from "@/lib/supabase/client";

type Input = z.input<typeof forgotPasswordSchema>;
type Output = z.output<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  async function onSubmit({ email }: Output) {
    setFormError(null);
    const supabase = tryCreateClient();
    if (!supabase) {
      setFormError(NOT_CONFIGURED_MESSAGE);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/update-password`,
    });
    // Only surface rate limiting; any other outcome shows the same neutral
    // message so the form cannot be used to discover registered emails.
    if (error && (error.status === 429 || error.code?.startsWith("over_"))) {
      setFormError(mapAuthError(error));
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <FormAlert tone="success" title="Richiesta inviata">
        Se esiste un account associato a questo indirizzo, riceverai un&apos;email con il link per reimpostare
        la password. Il link scade dopo un&apos;ora.
      </FormAlert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Recupera password">
      <FieldGroup>
        {formError ? <FormAlert>{formError}</FormAlert> : null}
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="nome@azienda.it"
          error={errors.email}
          {...register("email")}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Invia link di reimpostazione
        </Button>
      </FieldGroup>
    </form>
  );
}
