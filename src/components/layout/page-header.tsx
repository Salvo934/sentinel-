import Link from "next/link";
import type { ReactNode } from "react";

import { ChevronLeft } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {back ? (
          <Link href={back.href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <div className="text-xs font-medium tracking-wide text-teal uppercase">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description ? <div className="max-w-3xl text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
