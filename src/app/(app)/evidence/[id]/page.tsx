import { Download, ShieldCheck, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoBadge, InfoStatusBadge, ReliabilityBadge } from "@/components/common/badges";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FormField, SelectInput, TextArea, TextInput } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMembers, type EvidenceRow } from "@/features/cases/data";
import { updateEvidenceAction } from "@/features/evidence/actions";
import { DeleteEvidenceButton, VerifyIntegrityButton } from "@/features/evidence/components/evidence-controls";
import { EVIDENCE_TYPES, options } from "@/lib/domain";
import { formatBytes, formatDateTime } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Evidenza" };

export default async function EvidenceDetailPage({ params }: PageProps<"/evidence/[id]">) {
  const { id } = await params;
  const { active } = await requireActiveOrg();
  const supabase = await createClient();
  const { data } = await supabase.from("evidence").select("*, cases(id, title, case_ref, status)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const ev = data as EvidenceRow & { cases: { id: string; title: string; case_ref: string; status: string } };
  const members = await getMembers(active.organizationId);
  const collector = members.find((m) => m.user_id === ev.collected_by)?.full_name ?? "—";
  const writable = ev.cases.status !== "archived" && active.role !== "trainee";

  const rows: [string, React.ReactNode][] = [
    ["Caso", <Link key="c" href={`/investigations/${ev.case_id}?tab=evidence`} className="underline">{`${ev.cases.case_ref} · ${ev.cases.title}`}</Link>],
    ["Tipologia", EVIDENCE_TYPES[ev.evidence_type]],
    ["Fonte", ev.source ?? "—"],
    ["URL della fonte (testo inattivo)", ev.source_url ? <span className="font-mono break-all">{ev.source_url}</span> : "—"],
    ["Metodo di acquisizione", ev.acquisition_method ?? "—"],
    ["Data di acquisizione", formatDateTime(ev.collected_at)],
    ["Analista", collector],
    ["File", ev.original_filename ? `${ev.original_filename} (${ev.mime_type}, ${formatBytes(ev.size_bytes)})` : "Nessun file"],
    ["Percorso di archiviazione", ev.storage_path ? <span className="font-mono text-xs break-all">{ev.storage_path}</span> : "—"],
    ["SHA-256", ev.sha256_hash ? <span className="font-mono text-xs break-all">{ev.sha256_hash}</span> : "—"],
    ["Metadati", <pre key="m" className="text-xs whitespace-pre-wrap">{JSON.stringify(ev.metadata, null, 2)}</pre>],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/evidence", label: "Evidence Library" }}
        title={ev.title}
        description={
          <div className="mt-1 flex flex-wrap gap-1.5">
            <ReliabilityBadge value={ev.reliability} />
            <InfoStatusBadge value={ev.verification_status} />
            <DemoBadge show={ev.is_demo} />
          </div>
        }
        actions={
          <>
            {ev.storage_path ? (
              <>
                <Button asChild size="sm" variant="outline">
                  <a href={`/evidence/${ev.id}/download`} rel="noopener noreferrer">
                    <Download /> Scarica (link 60 s)
                  </a>
                </Button>
                <VerifyIntegrityButton evidenceId={ev.id} />
              </>
            ) : null}
            {active.role === "admin" ? <DeleteEvidenceButton evidenceId={ev.id} /> : null}
          </>
        }
      />

      {ev.last_integrity_check_at ? (
        <p className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${ev.last_integrity_ok ? "border-success/30 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
          {ev.last_integrity_ok ? <ShieldCheck className="size-4 text-success" /> : <ShieldX className="size-4 text-destructive" />}
          Ultima verifica di integrità: {formatDateTime(ev.last_integrity_check_at)} —{" "}
          {ev.last_integrity_ok ? "hash corrispondente" : "HASH NON CORRISPONDENTE"}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Scheda dell&apos;evidenza</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="grid gap-1 py-2 sm:grid-cols-[200px_1fr]">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
            {ev.description ? <p className="mt-4 text-sm whitespace-pre-wrap">{ev.description}</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Valutazione e annotazioni</CardTitle>
          </CardHeader>
          <CardContent>
            {writable ? (
              <ActionForm action={updateEvidenceAction.bind(null, ev.id)} successMessage="Evidenza aggiornata" className="grid gap-3">
                <FormField label="Titolo" htmlFor="title" required>
                  <TextInput name="title" defaultValue={ev.title} />
                </FormField>
                <FormField label="Affidabilità della fonte" htmlFor="reliability">
                  <SelectInput name="reliability" options={options.reliability} defaultValue={ev.reliability} />
                </FormField>
                <FormField label="Stato della verifica" htmlFor="verification_status">
                  <SelectInput name="verification_status" options={options.infoStatuses} defaultValue={ev.verification_status} />
                </FormField>
                <FormField label="Descrizione" htmlFor="description">
                  <TextArea name="description" rows={3} defaultValue={ev.description ?? ""} />
                </FormField>
                <FormField label="Note" htmlFor="notes">
                  <TextArea name="notes" rows={3} defaultValue={ev.notes ?? ""} />
                </FormField>
                <SubmitButton size="sm">Salva</SubmitButton>
                <p className="text-xs text-muted-foreground">File, percorso e hash non sono modificabili.</p>
              </ActionForm>
            ) : (
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{ev.notes ?? "Nessuna nota."}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
