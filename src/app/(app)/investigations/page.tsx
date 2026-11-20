import { FolderKanban, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CaseStatusBadge, DemoBadge, PriorityBadge, RiskBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { SelectInput } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMembers, type CaseRow } from "@/features/cases/data";
import {
  CASE_CATEGORIES,
  CASE_CATEGORY_VALUES,
  CASE_STATUS_VALUES,
  PRIORITY_VALUES,
  options,
} from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { requireActiveOrg } from "@/lib/org";
import { firstParam } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Investigations" };

const SORTS = {
  updated: ["updated_at", false],
  opened: ["opened_at", false],
  title: ["title", true],
  priority: ["priority", false],
} as const;

export default async function InvestigationsPage({ searchParams }: PageProps<"/investigations">) {
  const { active } = await requireActiveOrg();
  const params = await searchParams;
  const q = (firstParam(params.q) ?? "").trim().slice(0, 100);
  const status = firstParam(params.status);
  const category = firstParam(params.category);
  const priority = firstParam(params.priority);
  const sortKey = (firstParam(params.sort) ?? "updated") as keyof typeof SORTS;
  const [column, ascending] = SORTS[sortKey] ?? SORTS.updated;

  const supabase = await createClient();
  let query = supabase.from("cases").select("*").eq("organization_id", active.organizationId);
  if (status && (CASE_STATUS_VALUES as readonly string[]).includes(status)) query = query.eq("status", status);
  else query = query.neq("status", "archived");
  if (category && (CASE_CATEGORY_VALUES as readonly string[]).includes(category)) query = query.eq("category", category);
  if (priority && (PRIORITY_VALUES as readonly string[]).includes(priority)) query = query.eq("priority", priority);
  if (q) {
    // Escape PostgREST/ILIKE metacharacters in the user's search text.
    const safe = q.replace(/[%_\\,()*]/g, " ");
    query = query.or(`title.ilike.%${safe}%,case_ref.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  const { data, error } = await query.order(column, { ascending }).limit(200);
  const cases = (data ?? []) as CaseRow[];
  const members = await getMembers(active.organizationId);
  const nameOf = (id: string | null) => members.find((m) => m.user_id === id)?.full_name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investigations"
        description="Gestione dei casi investigativi: creazione, stato, attività, evidenze, timeline e report."
        actions={
          <Button asChild>
            <Link href="/investigations/new">
              <Plus /> Nuovo caso
            </Link>
          </Button>
        }
      />

      <form className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(4,minmax(0,180px))_auto]" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input name="q" defaultValue={q} placeholder="Cerca per titolo, riferimento, descrizione" className="pl-8" aria-label="Cerca" />
        </div>
        <SelectInput name="status" options={[...options.statuses]} defaultValue={status} placeholder="Stato: attivi" />
        <SelectInput name="category" options={options.categories} defaultValue={category} placeholder="Tutte le tipologie" />
        <SelectInput name="priority" options={options.priorities} defaultValue={priority} placeholder="Tutte le priorità" />
        <SelectInput
          name="sort"
          options={[
            ["updated", "Ultimo aggiornamento"],
            ["opened", "Data di apertura"],
            ["priority", "Priorità"],
            ["title", "Titolo (A-Z)"],
          ]}
          defaultValue={sortKey}
        />
        <Button type="submit" variant="secondary">
          Filtra
        </Button>
      </form>

      {error ? (
        <EmptyState icon={FolderKanban} title="Errore nel caricamento dei casi" />
      ) : cases.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nessun caso trovato"
          action={
            <Button asChild size="sm">
              <Link href="/investigations/new">
                <Plus /> Apri il primo caso
              </Link>
            </Button>
          }
        >
          Modifica i filtri oppure crea un nuovo caso. Puoi anche caricare i dati demo dalle impostazioni.
        </EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caso</TableHead>
                <TableHead className="hidden md:table-cell">Tipologia</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="hidden lg:table-cell">Priorità / rischio</TableHead>
                <TableHead className="hidden lg:table-cell">Responsabile</TableHead>
                <TableHead className="hidden sm:table-cell">Aggiornato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="max-w-md">
                    <Link href={`/investigations/${c.id}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{c.case_ref}</span>
                      <DemoBadge show={c.is_demo} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-xs md:table-cell">{CASE_CATEGORIES[c.category]}</TableCell>
                  <TableCell>
                    <CaseStatusBadge value={c.status} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      <PriorityBadge value={c.priority} />
                      <RiskBadge value={c.risk_level} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-xs lg:table-cell">{nameOf(c.assigned_to)}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">{formatDate(c.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
