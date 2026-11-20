import { KeyRound, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ToneBadge } from "@/components/common/tone-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FormField, SelectInput, TextInput } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMembers } from "@/features/cases/data";
import { addMemberAction, renameOrganizationAction, updateProfileAction } from "@/features/settings/actions";
import { DemoControls, RoleSelect } from "@/features/settings/controls";
import { ORG_ROLES, type OrgRole } from "@/lib/domain";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

const PLATFORM_ROLE = { administrator: "Administrator", analyst: "Analyst", trainee: "Trainee" } as const;

export default async function SettingsPage() {
  const { active, user, fullName, platformRole } = await requireActiveOrg();
  const isAdmin = active.role === "admin";
  const supabase = await createClient();
  const [members, { count: demoCount }] = await Promise.all([
    getMembers(active.organizationId),
    supabase.from("cases").select("id", { count: "exact", head: true }).eq("organization_id", active.organizationId).eq("is_demo", true),
  ]);
  const integrations = [
    ["VIRUSTOTAL_API_KEY", "VirusTotal (Fase 2)"],
    ["OTX_API_KEY", "AlienVault OTX (Fase 2)"],
    ["AI_PROVIDER_API_KEY", "AI Investigation Assistant (Fase 5)"],
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Profilo, organizzazione, membri e ruoli, modalità demo, integrazioni." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profilo</CardTitle>
            <CardDescription>
              {user.email} · ruolo di piattaforma: {PLATFORM_ROLE[platformRole]} (modificabile solo da un amministratore di piattaforma)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActionForm action={updateProfileAction} successMessage="Profilo aggiornato" className="flex flex-wrap items-end gap-2">
              <FormField label="Nome completo" htmlFor="full_name" className="min-w-60 flex-1">
                <TextInput name="full_name" defaultValue={fullName ?? ""} />
              </FormField>
              <SubmitButton>Salva</SubmitButton>
            </ActionForm>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>Tema (scuro predefinito)</span>
              <ThemeToggle />
            </div>
            <Link href="/update-password" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
              <KeyRound className="size-4" /> Cambia password
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organizzazione</CardTitle>
            <CardDescription>Il tuo ruolo: {ORG_ROLES[active.role]}</CardDescription>
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              <ActionForm action={renameOrganizationAction} successMessage="Organizzazione aggiornata" className="flex flex-wrap items-end gap-2">
                <FormField label="Nome" htmlFor="name" className="min-w-60 flex-1">
                  <TextInput name="name" defaultValue={active.name} />
                </FormField>
                <SubmitButton>Salva</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm">{active.name}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Membri e ruoli</CardTitle>
            <CardDescription>Administrator: gestione completa · Analyst: lettura/scrittura delle indagini · Trainee: lettura e propri casi formativi. I ruoli sono verificati dal database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y text-sm">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {m.full_name ?? "Utente"} {m.user_id === user.id ? <span className="text-xs text-muted-foreground">(tu)</span> : null}
                  </span>
                  {isAdmin ? <RoleSelect userId={m.user_id} role={m.role} /> : <ToneBadge tone="neutral">{ORG_ROLES[m.role as OrgRole]}</ToneBadge>}
                </li>
              ))}
            </ul>
            {isAdmin ? (
              <ActionForm action={addMemberAction} successMessage="Membro aggiunto" resetOnSuccess className="grid gap-2 sm:grid-cols-[1fr_160px_auto] sm:items-end">
                <FormField label="Email di un utente registrato" htmlFor="email">
                  <TextInput name="email" type="email" />
                </FormField>
                <FormField label="Ruolo" htmlFor="role">
                  <SelectInput name="role" options={Object.entries(ORG_ROLES)} defaultValue="analyst" />
                </FormField>
                <SubmitButton>Aggiungi</SubmitButton>
              </ActionForm>
            ) : null}
          </CardContent>
        </Card>

        <Card id="demo">
          <CardHeader>
            <CardTitle>Modalità demo</CardTitle>
            <CardDescription>
              Dati interamente fittizi (domini .example, IP di documentazione RFC 5737/3849), salvati su Supabase ed etichettati «Demo»,
              separati dai dati raccolti realmente. Non contengono dati personali di soggetti reali.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <span className="text-sm">{demoCount ? `Caricati (${demoCount} casi demo)` : "Non caricati"}</span>
            {isAdmin ? <DemoControls loaded={Boolean(demoCount)} /> : <span className="text-xs text-muted-foreground">Solo gli amministratori</span>}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" /> Integrazioni e sicurezza
            </CardTitle>
            <CardDescription>Le chiavi sono lette solo dal server (variabili d&apos;ambiente) e non vengono mai salvate nel database o esposte al browser.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm sm:grid-cols-3">
              {integrations.map(([env, label]) => (
                <li key={env} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <span>{label}</span>
                  <ToneBadge tone={process.env[env] ? "success" : "neutral"}>{process.env[env] ? "Configurata" : "Non configurata"}</ToneBadge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
