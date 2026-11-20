"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type PasswordFieldProps = Omit<ComponentProps<typeof Input>, "id" | "type"> & {
  id: string;
  label: string;
  description?: ReactNode;
  error?: { message?: string };
  labelAddon?: ReactNode;
};

export function PasswordField({
  id,
  label,
  description,
  error,
  labelAddon,
  ...inputProps
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const describedBy = [description ? `${id}-description` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Field data-invalid={error ? true : undefined}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {labelAddon}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className="h-9 pr-10"
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={visible ? "Nascondi password" : "Mostra password"}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {description ? <FieldDescription id={`${id}-description`}>{description}</FieldDescription> : null}
      <FieldError id={`${id}-error`} errors={error ? [error] : undefined} />
    </Field>
  );
}
