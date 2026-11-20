"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { dbFail, isUuid } from "@/lib/actions";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

import { answersFromForm, type Scenario } from "./types";

export async function startAttemptAction(scenarioId: string, slug: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  if (!isUuid(scenarioId)) return fail("Scenario non valido.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_training_attempt", { p_scenario: scenarioId });
  if (error) return dbFail(error, "start attempt");
  revalidatePath(`/training/${slug}`);
  revalidatePath("/training");
  return ok();
}

/** Saves answers; with intent=submit also asks the database to grade the attempt. */
export async function saveAttemptAction(attemptId: string, slug: string, _prev: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const supabase = await createClient();
  const { data: attempt } = await supabase.from("training_attempts").select("id, scenario_id, status").eq("id", attemptId).maybeSingle();
  if (!attempt) return fail("Tentativo non trovato.");
  if (attempt.status !== "in_progress") return fail("Questo tentativo è già stato consegnato.");
  const { data: scenario } = await supabase.from("training_scenarios").select("content, grading_rubric").eq("id", attempt.scenario_id).single();
  const sc = scenario as Pick<Scenario, "content" | "grading_rubric">;

  const answers = answersFromForm(
    sc.content.questions,
    (k) => (typeof formData.get(k) === "string" ? (formData.get(k) as string) : null),
    (k) => formData.getAll(k).filter((v): v is string => typeof v === "string"),
  );
  const self_assessment: Record<string, number> = {};
  for (const r of sc.grading_rubric) {
    const v = Number(formData.get(`rubric_${r.id}`));
    if (Number.isInteger(v) && v >= 0 && v <= 4) self_assessment[r.id] = v;
  }
  const submitted_content = String(formData.get("submitted_content") ?? "").slice(0, 50000);

  const { error } = await supabase.from("training_attempts").update({ answers, self_assessment, submitted_content }).eq("id", attemptId);
  if (error) return dbFail(error, "save attempt");

  if (formData.get("intent") === "submit") {
    if (submitted_content.trim().length < 50) return fail("La consegna dell'analista deve contenere almeno 50 caratteri.");
    const { error: submitError } = await supabase.rpc("submit_training_attempt", { p_attempt: attemptId });
    if (submitError) return dbFail(submitError, "submit attempt");
    await supabase.rpc("log_activity", {
      p_org: active.organizationId,
      p_case: null,
      p_action: "training.submitted",
      p_entity_type: "training_attempt",
      p_entity_id: attemptId,
      p_metadata: { scenario: slug },
    });
  }
  revalidatePath(`/training/${slug}`);
  revalidatePath("/training");
  return ok();
}

export async function discardAttemptAction(attemptId: string, slug: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_attempts").delete().eq("id", attemptId).select("id");
  if (error) return dbFail(error, "discard attempt");
  if (!data?.length) return fail("Impossibile annullare il tentativo.");
  revalidatePath(`/training/${slug}`);
  return ok();
}
