import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/domain";

const TONES: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-info/30 bg-info/10 text-info",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/35 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  teal: "border-teal/30 bg-teal/10 text-teal",
};

export function ToneBadge({ tone, children, className, title }: { tone: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
