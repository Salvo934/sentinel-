import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground";

export function FormField({
  label,
  htmlFor,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type Opt = readonly (readonly [string, string])[];

export function SelectInput({
  id,
  name,
  options,
  defaultValue,
  required,
  placeholder,
  className,
}: {
  id?: string;
  name: string;
  options: Opt;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <select id={id ?? name} name={name} defaultValue={defaultValue ?? ""} required={required} className={cn(selectClass, className)}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map(([value, text]) => (
        <option key={value} value={value}>
          {text}
        </option>
      ))}
    </select>
  );
}

export function TextInput(props: React.ComponentProps<typeof Input> & { name: string }) {
  return <Input id={props.id ?? props.name} {...props} />;
}

export function TextArea(props: React.ComponentProps<typeof Textarea> & { name: string }) {
  return <Textarea id={props.id ?? props.name} {...props} />;
}

export { selectClass };
