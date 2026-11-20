"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { dbFail, parseForm } from "@/lib/actions";
import { CONFIDENCE_VALUES, INFO_STATUS_VALUES } from "@/lib/domain";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

import { ATTACK_ID_RE } from "./suggest";

type Prev = ActionResult<unknown> | null;
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const mappingSchema = z.object({
  case_id: z.uuid("Seleziona un caso"),
  technique_id: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.split(/\s/)[0]!)
    .pipe(z.string().regex(ATTACK_ID_RE, "Identificativo di tecnica non valido (es. T1566.002)")),
  info_status: z.enum(INFO_STATUS_VALUES).default("hypothesis"),
  confidence: z.enum(CONFIDENCE_VALUES).default("low"),
  observation: z.preprocess(blank, z.string().trim().max(4000).optional()),
  evidence_id: z.preprocess(blank, z.uuid().optional()),
  source: z.preprocess(blank, z.enum(["manual", "phishing_lab", "domain_analysis", "attack_page"]).optional()),
});

const updateSchema = mappingSchema.pick({ info_status: true, confidence: true, observation: true, evidence_id: true });

export async function mapTechniqueAction(_prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const parsed = parseForm(mappingSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { data: tech } = await supabase.from("attack_techniques").select("id").eq("id", parsed.data.technique_id).maybeSingle();
  if (!tech) return fail(`La tecnica ${parsed.data.technique_id} non esiste nella versione di ATT&CK caricata.`);
  const { error } = await supabase.from("case_attack_techniques").insert({ ...parsed.data, source: parsed.data.source ?? "manual" });
  if (error) {
    if (error.code === "23505") return fail("Questa tecnica è già mappata sul caso.");
    return dbFail(error, "map technique");
  }
  revalidatePath(`/investigations/${parsed.data.case_id}`);
  revalidatePath(`/attack/${parsed.data.technique_id}`);
  revalidatePath("/attack");
  return ok();
}

export async function updateMappingAction(mappingId: string, caseId: string, _prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const parsed = parseForm(updateSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("case_attack_techniques")
    .update({ ...parsed.data, observation: parsed.data.observation ?? null, evidence_id: parsed.data.evidence_id ?? null })
    .eq("id", mappingId)
    .select("id");
  if (error) return dbFail(error, "update mapping");
  if (!data?.length) return fail("Operazione non consentita.");
  revalidatePath(`/investigations/${caseId}`);
  return ok();
}

export async function deleteMappingAction(mappingId: string, caseId: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const supabase = await createClient();
  const { data, error } = await supabase.from("case_attack_techniques").delete().eq("id", mappingId).select("id");
  if (error) return dbFail(error, "delete mapping");
  if (!data?.length) return fail("Operazione non consentita.");
  revalidatePath(`/investigations/${caseId}`);
  revalidatePath("/attack");
  return ok();
}
