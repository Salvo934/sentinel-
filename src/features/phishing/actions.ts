"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { dbFail, parseForm } from "@/lib/actions";
import { CONFIDENCE_VALUES, VERDICT_VALUES } from "@/lib/domain";
import { isDocumentationIndicator, isIPv4 } from "@/lib/indicators";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

import { analyzeEmail } from "./parser";
import { PHISHING_SAMPLES } from "./samples";

type Prev = ActionResult<unknown> | null;
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const saveSchema = z.object({
  title: z.string().trim().min(2, "Titolo obbligatorio").max(200),
  raw_message: z.string().min(20, "Incolla o carica il messaggio da analizzare").max(200_000, "Messaggio troppo lungo (max 200.000 caratteri)"),
  input_mode: z.enum(["upload", "paste", "training_sample"]),
  sample_key: z.preprocess(blank, z.string().max(80).optional()),
  case_id: z.preprocess(blank, z.uuid().optional()),
  verdict: z.enum(VERDICT_VALUES),
  confidence: z.enum(CONFIDENCE_VALUES),
  analyst_assessment: z.preprocess(blank, z.string().trim().max(10000).optional()),
  register_iocs: z.preprocess((v) => v === "on", z.boolean()),
});

const assessmentSchema = saveSchema.pick({ verdict: true, confidence: true, analyst_assessment: true, case_id: true });

export async function savePhishingAnalysisAction(_prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const parsed = parseForm(saveSchema, formData);
  if (!parsed.ok) return parsed.result;
  const input = parsed.data;
  if (input.input_mode === "training_sample" && !PHISHING_SAMPLES.some((s) => s.key === input.sample_key)) {
    return fail("Campione formativo non valido.");
  }

  // The server re-runs the analysis: stored results never come from the browser.
  const analysis = analyzeEmail(input.raw_message);
  const { headers, ...rest } = analysis;
  const summary = { ...rest, body: undefined };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("phishing_analyses")
    .insert({
      organization_id: active.organizationId,
      case_id: input.case_id ?? null,
      title: input.title,
      input_mode: input.input_mode,
      sample_key: input.sample_key ?? null,
      raw_message: input.raw_message,
      parsed: { ...summary, header_count: headers.length },
      indicators: analysis.findings,
      verdict: input.verdict,
      confidence: input.confidence,
      analyst_assessment: input.analyst_assessment ?? null,
    })
    .select("id")
    .single();
  if (error) return dbFail(error, "save phishing analysis");

  if (input.register_iocs) {
    const rows = [
      ...analysis.urls.map((u) => ({ indicator_type: "url" as const, indicator_value: u.href })),
      ...[...new Set(analysis.urls.map((u) => u.host).filter((h): h is string => Boolean(h) && !isIPv4(h!)))].map((h) => ({
        indicator_type: "domain" as const,
        indicator_value: h,
      })),
      ...analysis.ips.map((ip) => ({ indicator_type: "ipv4" as const, indicator_value: ip })),
    ].map((r) => ({
      ...r,
      organization_id: active.organizationId,
      case_id: input.case_id ?? null,
      source: `Phishing Lab: ${input.title}`.slice(0, 300),
      confidence: "low" as const,
      analyst_verdict: "undetermined" as const,
      analyst_notes: isDocumentationIndicator(r.indicator_type, r.indicator_value) ? "Valore di documentazione (campione formativo)." : null,
    }));
    if (rows.length) {
      const { error: iocError } = await supabase
        .from("ioc_indicators")
        .upsert(rows, { onConflict: "organization_id,indicator_type,indicator_value", ignoreDuplicates: true });
      if (iocError) console.error("[db] phishing iocs:", iocError.code);
    }
  }
  revalidatePath("/phishing");
  redirect(`/phishing/${data.id}`);
}

export async function updatePhishingAssessmentAction(id: string, _prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const parsed = parseForm(assessmentSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("phishing_analyses")
    .update({ ...parsed.data, case_id: parsed.data.case_id ?? null, analyst_assessment: parsed.data.analyst_assessment ?? null })
    .eq("id", id)
    .select("id");
  if (error) return dbFail(error, "update phishing");
  if (!data?.length) return fail("Non hai i permessi per modificare questa analisi.");
  revalidatePath(`/phishing/${id}`);
  return ok();
}
