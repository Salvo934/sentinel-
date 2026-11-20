import { MailWarning } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConfidenceBadge, DemoBadge, VerdictBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCaseOptions } from "@/features/cases/data";
import { PhishingAnalyzer } from "@/features/phishing/components/phishing-analyzer";
import type { Confidence, Verdict } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { firstParam } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Phishing Lab" };

export default async function PhishingPage({ searchParams }: PageProps<"/phishing">) {
  const { active } = await requireActiveOrg();
  const sample = firstParam((await searchParams).sample);
  const supabase = await createClient();
  const [cases, { data: saved }] = await Promise.all([
    getCaseOptions(active.organizationId),
    supabase
      .from("phishing_analyses")
      .select("id, title, verdict, confidence, input_mode, is_demo, created_at, indicators")
      .eq("organization_id", active.organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phishing Investigation Lab"
        description="Analisi statica di email sospette: header, SPF/DKIM/DMARC, URL come testo inattivo, allegati non aperti, valutazione documentata."
      />
      <PhishingAnalyzer cases={cases} initialSample={sample} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailWarning className="size-4" aria-hidden="true" /> Analisi salvate
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(saved ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna analisi salvata.</p>
          ) : (
            <ul className="divide-y">
              {saved!.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <Link href={`/phishing/${s.id}`} className="text-sm font-medium hover:underline">
                      {s.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(s.created_at)} · {(s.indicators as unknown[]).length} elementi sospetti rilevati
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <VerdictBadge value={s.verdict as Verdict} />
                    <ConfidenceBadge value={s.confidence as Confidence} />
                    <DemoBadge show={s.is_demo} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
