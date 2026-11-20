"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { dbFail, parseForm } from "@/lib/actions";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { findingSchema, iocSchema, iocUpdateSchema, sourceSchema } from "@/lib/validation";

type Prev = ActionResult<unknown> | null;

export async function createFindingAction(_prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const parsed = parseForm(findingSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { error } = await supabase.from("osint_findings").insert({ ...parsed.data, organization_id: active.organizationId });
  if (error) return dbFail(error, "create finding");
  revalidatePath("/osint");
  if (parsed.data.case_id) revalidatePath(`/investigations/${parsed.data.case_id}`);
  return ok();
}

export async function updateFindingStatusAction(findingId: string, _prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const parsed = parseForm(findingSchema.pick({ info_status: true, reliability: true, verification_notes: true }), formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { data, error } = await supabase.from("osint_findings").update(parsed.data).eq("id", findingId).select("id");
  if (error) return dbFail(error, "update finding");
  if (!data?.length) return fail("Non hai i permessi per modificare questo risultato.");
  revalidatePath("/osint");
  return ok();
}

export async function deleteFindingAction(findingId: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const supabase = await createClient();
  const { data, error } = await supabase.from("osint_findings").delete().eq("id", findingId).select("id");
  if (error) return dbFail(error, "delete finding");
  if (!data?.length) return fail("Operazione non consentita.");
  revalidatePath("/osint");
  return ok();
}

export async function createSourceAction(_prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const parsed = parseForm(sourceSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { error } = await supabase.from("osint_sources").insert({ ...parsed.data, organization_id: active.organizationId });
  if (error) return dbFail(error, "create source");
  revalidatePath("/osint");
  return ok();
}

// --- IOC registry ------------------------------------------------------------

export async function createIocAction(_prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const parsed = parseForm(iocSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { error } = await supabase.from("ioc_indicators").insert({ ...parsed.data, organization_id: active.organizationId });
  if (error) return dbFail(error, "create ioc");
  revalidatePath("/threat-intel");
  if (parsed.data.case_id) revalidatePath(`/investigations/${parsed.data.case_id}`);
  return ok();
}

export async function updateIocAction(iocId: string, _prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const parsed = parseForm(iocUpdateSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ioc_indicators")
    .update({ ...parsed.data, case_id: parsed.data.case_id ?? null })
    .eq("id", iocId)
    .select("id");
  if (error) return dbFail(error, "update ioc");
  if (!data?.length) return fail("Non hai i permessi per modificare questo indicatore.");
  revalidatePath("/threat-intel");
  return ok();
}

export async function deleteIocAction(iocId: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const supabase = await createClient();
  const { data, error } = await supabase.from("ioc_indicators").delete().eq("id", iocId).select("id");
  if (error) return dbFail(error, "delete ioc");
  if (!data?.length) return fail("Operazione non consentita.");
  revalidatePath("/threat-intel");
  return ok();
}
