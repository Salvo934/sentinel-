import { FilePlus2, FolderLock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DemoBadge, InfoStatusBadge, ReliabilityBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { SelectInput } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCaseOptions, type EvidenceRow } from "@/features/cases/data";
import { EVIDENCE_TYPES, EVIDENCE_TYPE_VALUES, INFO_STATUS_VALUES, options } from "@/lib/domain";
import { formatBytes, formatDateTime } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { firstParam } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Evidence Library" };

export default async function EvidenceLibraryPage({ searchParams }: PageProps<"/evidence">) {
  const { active } = await requireActiveOrg();
  const sp = await searchParams;
  const caseId = firstParam(sp.case);
  const type = firstParam(sp.type);
  const status = firstParam(sp.status);
  const supabase = await createClient();
  let query = supabase
    .from("evidence")
    .select("*, cases!inner(case_ref, title, organization_id)")
    .eq("cases.organization_id", active.organizationId);
  if (caseId) query = query.eq("case_id", caseId);
  if (type && (EVIDENCE_TYPE_VALUES as readonly string[]).includes(type)) query = query.eq("evidence_type", type);
  if (status && (INFO_STATUS_VALUES as readonly string[]).includes(status)) query = query.eq("verification_status", status);
  const { data } = await query.order("collected_at", { ascending: false }).limit(300);
  const rows = (data ?? []) as (EvidenceRow & { cases: { case_ref: string; title: string } })[];
  const cases = await getCaseOptions(active.organizationId, { includeArchived: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence Library"
        description="Archivio strutturato delle evidenze di tutti i casi accessibili. File privati, hash SHA-256, verifica di integrità."
        actions={
          <Button asChild>
            <Link href="/evidence/new">
              <FilePlus2 /> Nuova evidenza
            </Link>
          </Button>
        }
      />
      <form className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <SelectInput name="case" options={cases} defaultValue={caseId} placeholder="Tutti i casi" />
        <SelectInput name="type" options={options.evidenceTypes} defaultValue={type} placeholder="Tutte le tipologie" />
        <SelectInput name="status" options={options.infoStatuses} defaultValue={status} placeholder="Qualsiasi stato di verifica" />
        <Button type="submit" variant="secondary">
          Filtra
        </Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState icon={FolderLock} title="Nessuna evidenza">
          Registra un&apos;evidenza e collegala a un caso investigativo.
        </EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evidenza</TableHead>
                <TableHead className="hidden md:table-cell">Caso</TableHead>
                <TableHead className="hidden lg:table-cell">File / SHA-256</TableHead>
                <TableHead>Valutazione</TableHead>
                <TableHead className="hidden sm:table-cell">Acquisita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link href={`/evidence/${e.id}`} className="font-medium hover:underline">
                      {e.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      {EVIDENCE_TYPES[e.evidence_type]} <DemoBadge show={e.is_demo} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-xs md:table-cell">
                    <Link href={`/investigations/${e.case_id}?tab=evidence`} className="hover:underline">
                      <span className="font-mono">{e.cases.case_ref}</span> {e.cases.title}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-xs lg:table-cell">
                    {e.sha256_hash ? (
                      <>
                        <span>{formatBytes(e.size_bytes)}</span>
                        <span className="block font-mono text-muted-foreground">{e.sha256_hash.slice(0, 20)}…</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Nessun file</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <ReliabilityBadge value={e.reliability} />
                      <InfoStatusBadge value={e.verification_status} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">{formatDateTime(e.collected_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
