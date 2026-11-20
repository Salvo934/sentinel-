"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { FormAlert } from "@/components/forms/form-alert";
import { PasswordField } from "@/components/forms/password-field";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { mapAuthError } from "@/features/auth/errors";
import { loginSchema } from "@/features/auth/schemas";
import { safeRedirectPath } from "@/lib/auth/routes";
import { NOT_CONFIGURED_MESSAGE, tryCreateClient } from "@/lib/supabase/client";

type Input = z.input<typeof loginSchema>;
type Output = z.output<typeof loginSchema>;

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  async function onSubmit(values: Output) {
    setFormError(null);
    // Called from the browser on purpose: Supabase Auth rate-limits per client IP.
    const supabase = tryCreateClient();
    if (!supabase) {
      setFormError(NOT_CONFIGURED_MESSAGE);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setFormError(mapAuthError(error));
      return;
    }
    toast.success("Accesso effettuato");
    router.replace(safeRedirectPath(next));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Accedi">
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
        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          error={errors.password}
          labelAddon={
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Password dimenticata?
            </Link>
          }
          {...register("password")}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isSubmitting ? "Accesso in corso…" : "Accedi"}
        </Button>
      </FieldGroup>
    </form>
  );
}
