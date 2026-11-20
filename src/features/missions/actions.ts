"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { dbFail, isUuid } from "@/lib/actions";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

import type { CheckResult, Debrief } from "./types";

export async function startMissionAction(missionId: string, slug: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  if (!isUuid(missionId)) return fail("Missione non valida.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_mission", { p_mission: missionId });
  if (error) return dbFail(error, "start mission");
  revalidatePath(`/missions/${slug}`);
  revalidatePath("/missions");
  return ok();
}

export async function linkMissionCaseAction(runId: string, slug: string, caseId: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  if (!isUuid(runId) || !isUuid(caseId)) return fail("Seleziona un caso.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_mission_case", { p_run: runId, p_case: caseId });
  if (error) return dbFail(error, "link mission case");
  revalidatePath(`/missions/${slug}`);
  return ok();
}

export async function checkMissionStepAction(runId: string, slug: string, stepId: string, answer: unknown): Promise<ActionResult<CheckResult>> {
  await requireActiveOrg();
  if (!isUuid(runId) || !/^[a-z0-9_-]{1,20}$/i.test(stepId)) return fail("Passo non valido.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_mission_step", {
    p_run: runId,
    p_step: stepId,
    p_answer: answer === undefined ? null : answer,
  });
  if (error) return dbFail(error, "check mission step");
  revalidatePath(`/missions/${slug}`);
  return ok(data as CheckResult);
}

export async function completeMissionAction(runId: string, slug: string): Promise<ActionResult<Debrief>> {
  const { active } = await requireActiveOrg();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_mission", { p_run: runId });
  if (error) return error.code === "23514" ? fail("Completa prima tutti i passi.") : dbFail(error, "complete mission");
  await supabase.rpc("log_activity", {
    p_org: active.organizationId,
    p_case: null,
    p_action: "mission.completed",
    p_entity_type: "mission_run",
    p_entity_id: runId,
    p_metadata: { mission: slug },
  });
  revalidatePath(`/missions/${slug}`);
  revalidatePath("/missions");
  return ok(data as Debrief);
}

export async function abandonMissionAction(runId: string, slug: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const supabase = await createClient();
  const { data, error } = await supabase.from("mission_runs").delete().eq("id", runId).select("id");
  if (error) return dbFail(error, "abandon mission");
  if (!data?.length) return fail("Impossibile annullare la missione.");
  revalidatePath(`/missions/${slug}`);
  return ok();
}
