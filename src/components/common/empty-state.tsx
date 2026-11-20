import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {children ? <div className="max-w-md text-sm text-muted-foreground">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}
