import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type FormAlertProps = {
  tone?: "error" | "success" | "info";
  title?: string;
  children: ReactNode;
  className?: string;
};

const toneStyles = {
  error: "border-destructive/30 bg-destructive/5 text-destructive",
  success: "border-success/30 bg-success/10 text-foreground [&>svg]:text-success",
  info: "border-info/30 bg-info/5 text-foreground [&>svg]:text-info",
} as const;

export function FormAlert({ tone = "error", title, children, className }: FormAlertProps) {
  const Icon = tone === "error" ? CircleAlert : tone === "success" ? CircleCheck : Info;
  return (
    <Alert
      className={cn(toneStyles[tone], className)}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <Icon />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription className={tone === "error" ? undefined : "text-muted-foreground"}>
        {children}
      </AlertDescription>
    </Alert>
  );
}
