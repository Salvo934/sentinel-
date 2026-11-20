import { FilePlus2, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DemoBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CLASSIFICATIONS, REPORT_TYPES, type Classification, type ReportType } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { active } = await requireActiveOrg();
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("id, title, report_type, version, status, classification, storage_path, is_demo, updated_at, case_id, cases!inner(case_ref, organization_id)")
    .eq("cases.organization_id", active.organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);
  const reports = data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Professional Report Generator"
        description="Report versionati collegati ai casi, generati solo con i dati presenti nel database o scritti dall'analista. Esportazione PDF con archiviazione privata."
        actions={
          <Button asChild>
            <Link href="/reports/new">
              <FilePlus2 /> Nuovo report
            </Link>
          </Button>
        }
      />
      {reports.length === 0 ? (
        <EmptyState icon={FileText} title="Nessun report">
          Crea un report a partire da un caso investigativo.
        </EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead className="hidden md:table-cell">Tipologia</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="hidden lg:table-cell">Classificazione</TableHead>
                <TableHead className="hidden sm:table-cell">Aggiornato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/reports/${r.id}`} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{(r.cases as unknown as { case_ref: string }).case_ref}</span> · v{r.version}
                      {r.storage_path ? " · PDF archiviato" : ""}
                      <DemoBadge show={r.is_demo} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-xs md:table-cell">{REPORT_TYPES[r.report_type as ReportType]}</TableCell>
                  <TableCell>
                    <ToneBadge tone={r.status === "final" ? "success" : "info"}>{r.status === "final" ? "Finale" : "Bozza"}</ToneBadge>
                  </TableCell>
                  <TableCell className="hidden text-xs lg:table-cell">{CLASSIFICATIONS[r.classification as Classification]}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">{formatDateTime(r.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
