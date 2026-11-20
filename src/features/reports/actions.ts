"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { dbFail, isUuid, parseForm } from "@/lib/actions";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { REPORT_SECTIONS, reportContentSchema, reportCreateSchema } from "@/lib/validation";

type Prev = ActionResult<unknown> | null;

export async function createReportAction(_prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const parsed = parseForm(reportCreateSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { data: c } = await supabase.from("cases").select("objective").eq("id", parsed.data.case_id).maybeSingle();
  if (!c) return fail("Caso non trovato o non accessibile.");
  // Only the case objective (already in the database) is pre-filled; every other
  // narrative section starts empty and must be written by the analyst.
  const { data, error } = await supabase
    .from("reports")
    .insert({ ...parsed.data, content: { objective: c.objective ?? "" } })
    .select("id")
    .single();
  if (error) return dbFail(error, "create report");
  revalidatePath("/reports");
  redirect(`/reports/${data.id}`);
}

export async function saveReportAction(reportId: string, _prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const parsed = parseForm(reportContentSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { title, classification, ...sections } = parsed.data;
  const content = Object.fromEntries(
    [...REPORT_SECTIONS.map((s) => s.key), "confidence"].map((k) => [k, (sections as Record<string, string | undefined>)[k] ?? ""]),
  );
  const supabase = await createClient();
  const { data, error } = await supabase.from("reports").update({ title, classification, content }).eq("id", reportId).eq("status", "draft").select("id");
  if (error) return dbFail(error, "save report");
  if (!data?.length) return fail("Il report non è modificabile (versione finale o permessi insufficienti).");
  revalidatePath(`/reports/${reportId}`);
  return ok();
}

export async function finalizeReportAction(reportId: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const supabase = await createClient();
  const { data, error } = await supabase.from("reports").update({ status: "final" }).eq("id", reportId).eq("status", "draft").select("id");
  if (error) return dbFail(error, "finalize report");
  if (!data?.length) return fail("Impossibile finalizzare il report.");
  revalidatePath(`/reports/${reportId}`);
  return ok();
}

export async function newReportVersionAction(reportKey: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  if (!isUuid(reportKey)) return fail("Report non valido.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_report_version", { p_report_key: reportKey });
  if (error) return dbFail(error, "new version");
  redirect(`/reports/${data}`);
}

/** Called after the browser uploaded the PDF into the private bucket (RLS-checked). */
export async function attachReportPdfAction(reportId: string, storagePath: string): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const supabase = await createClient();
  const { data: report } = await supabase.from("reports").select("id, case_id").eq("id", reportId).maybeSingle();
  if (!report) return fail("Report non trovato.");
  const expectedPrefix = `${active.organizationId}/${report.case_id}/${reportId}-`;
  if (!storagePath.startsWith(expectedPrefix) || !storagePath.endsWith(".pdf") || storagePath.includes("..")) {
    return fail("Percorso del file non valido.");
  }
  const { data, error } = await supabase.from("reports").update({ storage_path: storagePath }).eq("id", reportId).select("id");
  if (error) return dbFail(error, "attach pdf");
  if (!data?.length) return fail("Non hai i permessi per archiviare questo report.");
  await supabase.rpc("log_activity", {
    p_org: active.organizationId,
    p_case: report.case_id,
    p_action: "report.exported",
    p_entity_type: "report",
    p_entity_id: reportId,
    p_metadata: { storage_path: storagePath },
  });
  revalidatePath(`/reports/${reportId}`);
  return ok();
}

export async function deleteReportAction(reportId: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const supabase = await createClient();
  const { data, error } = await supabase.from("reports").delete().eq("id", reportId).select("id, case_id");
  if (error) return dbFail(error, "delete report");
  if (!data?.length) return fail("Le versioni finali possono essere eliminate solo da un amministratore.");
  revalidatePath("/reports");
  redirect("/reports");
}
