import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export function StatCard({ label, value, icon: Icon, href, hint }: { label: string; value: number | string; icon: LucideIcon; href?: string; hint?: string }) {
  const body = (
    <div className="flex h-full items-start justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
    </div>
  );
  return href ? (
    <Link href={href} className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {body}
    </Link>
  ) : (
    body
  );
}
