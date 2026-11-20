"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormAlert } from "@/components/forms/form-alert";
import { PasswordField } from "@/components/forms/password-field";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { mapAuthError } from "@/features/auth/errors";
import { PASSWORD_MIN_LENGTH, signUpSchema } from "@/features/auth/schemas";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth/routes";
import { NOT_CONFIGURED_MESSAGE, tryCreateClient } from "@/lib/supabase/client";

type Input = z.input<typeof signUpSchema>;
type Output = z.output<typeof signUpSchema>;

export function SignUpForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
    mode: "onTouched",
  });

  async function onSubmit({ fullName, email, password }: Output) {
    setFormError(null);
    const supabase = tryCreateClient();
    if (!supabase) {
      setFormError(NOT_CONFIGURED_MESSAGE);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // Used only when the hosted project keeps the default email template.
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${DEFAULT_AUTHENTICATED_PATH}`,
      },
    });
    if (error) {
      setFormError(mapAuthError(error));
      return;
    }
    if (data.session) {
      // Email confirmation disabled on this Supabase project.
      router.replace(DEFAULT_AUTHENTICATED_PATH);
      router.refresh();
      return;
    }
    // Same message whether or not the address was already registered
    // (Supabase returns an obfuscated user to prevent enumeration).
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 text-center" role="status" aria-live="polite">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold">Controlla la tua email</h2>
        <p className="text-sm text-muted-foreground">
          Se l&apos;indirizzo <strong className="text-foreground">{sentTo}</strong> può essere registrato,
          riceverai un link per confermare l&apos;account. Il link scade dopo un&apos;ora.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Crea account">
      <FieldGroup>
        {formError ? <FormAlert>{formError}</FormAlert> : null}
        <TextField
          id="fullName"
          label="Nome e cognome"
          autoComplete="name"
          error={errors.fullName}
          {...register("fullName")}
        />
        <TextField
          id="email"
          label="Email di lavoro"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="nome@azienda.it"
          error={errors.email}
          {...register("email")}
        />
        <PasswordField
          id="password"
          label="Password"
          autoComplete="new-password"
          description={`Almeno ${PASSWORD_MIN_LENGTH} caratteri, con maiuscole, minuscole e cifre.`}
          error={errors.password}
          {...register("password")}
        />
        <PasswordField
          id="confirmPassword"
          label="Conferma password"
          autoComplete="new-password"
          error={errors.confirmPassword}
          {...register("confirmPassword")}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isSubmitting ? "Creazione in corso…" : "Crea account"}
        </Button>
      </FieldGroup>
    </form>
  );
}
