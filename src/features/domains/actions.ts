"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { dbFail, parseForm } from "@/lib/actions";
import { RISK_LEVEL_VALUES } from "@/lib/domain";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { domainInputSchema } from "@/lib/validation";

import { collectDomainReport } from "./lookup";
import type { DomainReport } from "./model";

const RATE_LIMIT_PER_MINUTE = 10;

export type LinkedCase = { id: string; case_ref: string; title: string; via: string };
export type AnalyzeResult = { report: DomainReport; linkedCases: LinkedCase[]; cached: boolean };

async function rateLimited(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc("recent_query_count", { p_seconds: 60 });
  return typeof data === "number" && data >= RATE_LIMIT_PER_MINUTE;
}

export async function analyzeDomainAction(rawDomain: string): Promise<ActionResult<AnalyzeResult>> {
  const { active } = await requireActiveOrg();
  const parsed = domainInputSchema.safeParse(rawDomain);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dominio non valido");
  const domain = parsed.data;
  const supabase = await createClient();

  if (await rateLimited(supabase)) {
    await supabase.from("osint_queries").insert({
      organization_id: active.organizationId,
      query_type: "dns",
      query_value: domain,
      provider: "system",
      outcome: "rate_limited",
    });
    return fail(`Limite di ${RATE_LIMIT_PER_MINUTE} interrogazioni al minuto raggiunto. Attendi qualche secondo.`);
  }

  const started = Date.now();
  const { report, cached } = await collectDomainReport(domain);
  const duration = Date.now() - started;
  const outcome = cached ? "cached" : report.dataMode === "simulated" ? "simulated" : "ok";
  await supabase.from("osint_queries").insert([
    { organization_id: active.organizationId, query_type: "dns", query_value: domain, provider: report.dataMode === "live" ? "system-resolver" : "simulated", outcome, duration_ms: duration },
    {
      organization_id: active.organizationId,
      query_type: "rdap",
      query_value: domain,
      provider: report.rdap?.source ?? "rdap.org",
      outcome: report.rdapError && !cached ? "error" : outcome,
      duration_ms: duration,
    },
  ]);

  // Links with existing cases (IOC, saved analyses, OSINT findings).
  const [iocs, analyses, findings] = await Promise.all([
    supabase.from("ioc_indicators").select("case_id, cases(id, case_ref, title)").eq("organization_id", active.organizationId).eq("indicator_value", domain).not("case_id", "is", null),
    supabase.from("domain_analyses").select("case_id, cases(id, case_ref, title)").eq("organization_id", active.organizationId).eq("domain", domain).not("case_id", "is", null),
    supabase.from("osint_findings").select("case_id, cases(id, case_ref, title)").eq("organization_id", active.organizationId).ilike("subject", `%${domain}%`).not("case_id", "is", null),
  ]);
  const linked = new Map<string, LinkedCase>();
  const addLinks = (rows: { cases: unknown }[] | null, via: string) =>
    (rows ?? []).forEach((r) => {
      const c = r.cases as { id: string; case_ref: string; title: string } | null;
      if (c && !linked.has(c.id)) linked.set(c.id, { ...c, via });
    });
  addLinks(iocs.data, "registro IOC");
  addLinks(analyses.data, "analisi salvata");
  addLinks(findings.data, "risultato OSINT");

  return ok({ report, linkedCases: [...linked.values()], cached });
}

const saveSchema = z.object({
  domain: domainInputSchema,
  case_id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  analyst_notes: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(10000).optional()),
  risk_level: z.enum(RISK_LEVEL_VALUES, { message: "Assegna un livello di rischio" }),
  risk_rationale: z.string().trim().min(10, "Motiva il livello di rischio (almeno 10 caratteri)").max(4000),
});

export async function saveDomainAnalysisAction(_prev: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const parsed = parseForm(saveSchema, formData);
  if (!parsed.ok) return parsed.result;
  const input = parsed.data;
  // The stored data always comes from the server (cache or a fresh collection), never from the browser.
  const { report } = await collectDomainReport(input.domain);
  const supabase = await createClient();
  const { error } = await supabase.from("domain_analyses").insert({
    organization_id: active.organizationId,
    case_id: input.case_id ?? null,
    domain: input.domain,
    data_mode: report.dataMode,
    dns: { ...report.dns, errors: report.dnsErrors, collected_at: report.collectedAt },
    rdap: report.rdap ? { ...report.rdap } : report.rdapError ? { error: report.rdapError } : null,
    anomalies: report.anomalies,
    analyst_notes: input.analyst_notes ?? null,
    risk_level: input.risk_level,
    risk_rationale: input.risk_rationale,
  });
  if (error) return dbFail(error, "save domain analysis");
  revalidatePath("/domains");
  return ok();
}
