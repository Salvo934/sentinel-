import { ShieldHalf } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-teal text-primary-foreground shadow-sm",
          inverted && "from-sidebar-primary to-primary text-sidebar-primary-foreground",
        )}
      >
        <ShieldHalf className="size-4.5" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn("text-sm font-semibold tracking-[0.18em]", inverted ? "text-sidebar-foreground" : "text-foreground")}>
          SENTINEL
        </span>
        <span className={cn("text-[10px] font-medium tracking-[0.24em]", inverted ? "text-sidebar-primary" : "text-teal")}>
          INTELLIGENCE
        </span>
      </span>
    </span>
  );
}
