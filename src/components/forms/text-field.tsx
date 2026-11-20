"use client";

import type { ComponentProps, ReactNode } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type TextFieldProps = Omit<ComponentProps<typeof Input>, "id"> & {
  id: string;
  label: string;
  description?: ReactNode;
  error?: { message?: string };
  labelAddon?: ReactNode;
};

/** Accessible label + input + description + error, wired with aria attributes. */
export function TextField({ id, label, description, error, labelAddon, ...inputProps }: TextFieldProps) {
  const describedBy = [description ? `${id}-description` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Field data-invalid={error ? true : undefined}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {labelAddon}
      </div>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="h-9"
        {...inputProps}
      />
      {description ? <FieldDescription id={`${id}-description`}>{description}</FieldDescription> : null}
      <FieldError id={`${id}-error`} errors={error ? [error] : undefined} />
    </Field>
  );
}
