"use client";

import type { ReactNode } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { value: string; label: string; hint?: string | null };

type SelectFieldProps = {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly Option[];
  error?: { message?: string };
  description?: ReactNode;
  disabled?: boolean;
  placeholder?: string;
};

export function SelectField({
  id,
  label,
  value,
  onValueChange,
  options,
  error,
  description,
  disabled,
  placeholder,
}: SelectFieldProps) {
  const describedBy = [description ? `${id}-description` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className="h-9 w-full"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
              {option.hint ? <span className="text-xs text-muted-foreground">{option.hint}</span> : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? <FieldDescription id={`${id}-description`}>{description}</FieldDescription> : null}
      <FieldError id={`${id}-error`} errors={error ? [error] : undefined} />
    </Field>
  );
}
