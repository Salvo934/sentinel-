import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ToneBadge } from "@/components/common/tone-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Honest placeholder for roadmap modules: nothing here pretends to work. */
export function PlannedModule({ title, phase, icon: Icon, description, features, ready }: { title: string; phase: string; icon: LucideIcon; description: string; features: string[]; ready: ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} eyebrow={<ToneBadge tone="warning">Funzione pianificata · {phase}</ToneBadge>} description={description} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon className="size-4" /> Funzionalità previste
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Già predisposto nell&apos;MVP</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{ready}</CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">Questa pagina non contiene funzioni operative: il modulo non è ancora stato sviluppato.</p>
    </div>
  );
}
