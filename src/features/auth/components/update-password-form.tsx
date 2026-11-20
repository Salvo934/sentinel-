"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { FormAlert } from "@/components/forms/form-alert";
import { PasswordField } from "@/components/forms/password-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { mapAuthError } from "@/features/auth/errors";
import { PASSWORD_MIN_LENGTH, updatePasswordSchema } from "@/features/auth/schemas";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth/routes";
import { NOT_CONFIGURED_MESSAGE, tryCreateClient } from "@/lib/supabase/client";

type Input = z.input<typeof updatePasswordSchema>;
type Output = z.output<typeof updatePasswordSchema>;

export function UpdatePasswordForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onTouched",
  });

  async function onSubmit({ password }: Output) {
    setFormError(null);
    const supabase = tryCreateClient();
    if (!supabase) {
      setFormError(NOT_CONFIGURED_MESSAGE);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFormError(mapAuthError(error));
      return;
    }
    toast.success("Password aggiornata");
    router.replace(DEFAULT_AUTHENTICATED_PATH);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Imposta nuova password">
      <FieldGroup>
        {formError ? <FormAlert>{formError}</FormAlert> : null}
        <PasswordField
          id="password"
          label="Nuova password"
          autoComplete="new-password"
          description={`Almeno ${PASSWORD_MIN_LENGTH} caratteri, con maiuscole, minuscole e cifre.`}
          error={errors.password}
          {...register("password")}
        />
        <PasswordField
          id="confirmPassword"
          label="Conferma nuova password"
          autoComplete="new-password"
          error={errors.confirmPassword}
          {...register("confirmPassword")}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Salva nuova password
        </Button>
      </FieldGroup>
    </form>
  );
}
