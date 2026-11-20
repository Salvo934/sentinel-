"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { dbFail, isUuid, parseForm } from "@/lib/actions";
import { CASE_STATUS_VALUES, TASK_STATUS_VALUES, type CaseStatus, type TaskStatus } from "@/lib/domain";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { caseSchema, eventSchema, taskSchema } from "@/lib/validation";

type Prev = ActionResult<unknown> | null;

export async function createCaseAction(_prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const parsed = parseForm(caseSchema, formData);
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cases")
    .insert({ ...parsed.data, organization_id: active.organizationId })
    .select("id")
    .single();
  if (error) return dbFail(error, "create case");
  revalidatePath("/investigations");
  redirect(`/investigations/${data.id}`);
}

export async function updateCaseAction(caseId: string, _prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  if (!isUuid(caseId)) return fail("Caso non valido.");
  const parsed = parseForm(caseSchema, formData);
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cases")
    .update({ ...parsed.data, assigned_to: parsed.data.assigned_to ?? null })
    .eq("id", caseId)
    .select("id");
  if (error) return dbFail(error, "update case");
  if (!data?.length) return fail("Non hai i permessi per modificare questo caso.");
  revalidatePath(`/investigations/${caseId}`);
  return ok();
}

export async function setCaseStatusAction(caseId: string, status: CaseStatus): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  if (!isUuid(caseId) || !CASE_STATUS_VALUES.includes(status)) return fail("Richiesta non valida.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("cases").update({ status }).eq("id", caseId).select("id");
  if (error) return dbFail(error, "case status");
  if (!data?.length) return fail("Non hai i permessi per modificare questo caso.");
  revalidatePath(`/investigations/${caseId}`);
  revalidatePath("/investigations");
  return ok();
}

/** Controlled deletion: the database only allows admins to delete archived cases. */
export async function deleteCaseAction(caseId: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  if (!isUuid(caseId)) return fail("Caso non valido.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("cases").delete().eq("id", caseId).select("id");
  if (error) return dbFail(error, "delete case");
  if (!data?.length) return fail("Solo un amministratore può eliminare un caso, e solo dopo averlo archiviato.");
  revalidatePath("/investigations");
  redirect("/investigations");
}

// --- Tasks ---------------------------------------------------------------------

export async function createTaskAction(caseId: string, _prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const parsed = parseForm(taskSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { error } = await supabase.from("case_tasks").insert({ ...parsed.data, case_id: caseId });
  if (error) return dbFail(error, "create task");
  revalidatePath(`/investigations/${caseId}`);
  return ok();
}

export async function setTaskStatusAction(caseId: string, taskId: string, status: TaskStatus): Promise<void> {
  await requireActiveOrg();
  if (!isUuid(taskId) || !TASK_STATUS_VALUES.includes(status)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("case_tasks").update({ status }).eq("id", taskId);
  if (error) console.error("[db] task status", error.code);
  revalidatePath(`/investigations/${caseId}`);
}

export async function deleteTaskAction(caseId: string, taskId: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const supabase = await createClient();
  const { data, error } = await supabase.from("case_tasks").delete().eq("id", taskId).select("id");
  if (error) return dbFail(error, "delete task");
  if (!data?.length) return fail("Operazione non consentita.");
  revalidatePath(`/investigations/${caseId}`);
  return ok();
}

// --- Timeline events ---------------------------------------------------------------

export async function createEventAction(caseId: string, _prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const parsed = parseForm(eventSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { recorded_at, ...rest } = parsed.data;
  const { error } = await supabase
    .from("investigation_events")
    .insert({ ...rest, ...(recorded_at ? { recorded_at } : {}), case_id: caseId });
  if (error) return dbFail(error, "create event");
  revalidatePath(`/investigations/${caseId}`);
  return ok();
}

export async function updateEventAction(caseId: string, eventId: string, _prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const parsed = parseForm(eventSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { recorded_at, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("investigation_events")
    .update({ ...rest, evidence_id: rest.evidence_id ?? null, ...(recorded_at ? { recorded_at } : {}) })
    .eq("id", eventId)
    .select("id");
  if (error) return dbFail(error, "update event");
  if (!data?.length) return fail("Operazione non consentita.");
  revalidatePath(`/investigations/${caseId}`);
  return ok();
}

export async function deleteEventAction(caseId: string, eventId: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const supabase = await createClient();
  const { data, error } = await supabase.from("investigation_events").delete().eq("id", eventId).select("id");
  if (error) return dbFail(error, "delete event");
  if (!data?.length) return fail("Operazione non consentita.");
  revalidatePath(`/investigations/${caseId}`);
  return ok();
}
