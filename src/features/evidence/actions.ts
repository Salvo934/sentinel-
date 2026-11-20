"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { dbFail, isUuid, parseForm } from "@/lib/actions";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { evidenceSchema, evidenceUpdateSchema } from "@/lib/validation";

import { checkEvidenceFile, sanitizeFilename } from "./files";

const BUCKET = "investigation-evidence";
type Prev = ActionResult<unknown> | null;

/**
 * Registers a piece of evidence. When a file is attached, the SHA-256 is
 * computed here on the server from the exact bytes that are stored, so the
 * hash cannot be forged by the browser.
 */
export async function createEvidenceAction(_prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const parsed = parseForm(evidenceSchema, formData);
  if (!parsed.ok) return parsed.result;
  const meta = parsed.data;

  const supabase = await createClient();
  const { data: caseRow } = await supabase.from("cases").select("id, organization_id, status").eq("id", meta.case_id).maybeSingle();
  if (!caseRow) return fail("Caso non trovato o non accessibile.");
  if (caseRow.status === "archived") return fail("Il caso è archiviato: non è possibile aggiungere evidenze.");

  const file = formData.get("file");
  let fileFields: Record<string, unknown> = {};
  let storagePath: string | null = null;

  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkEvidenceFile(file.name, file.size, bytes);
    if (!check.ok) return fail(check.error);

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const safeName = sanitizeFilename(file.name);
    storagePath = `${caseRow.organization_id}/${caseRow.id}/${randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: check.mime,
      upsert: false,
    });
    if (uploadError) {
      console.error("[storage] evidence upload:", uploadError.message);
      return fail("Caricamento del file non riuscito (permessi, tipo o dimensione non ammessi).");
    }
    fileFields = {
      storage_path: storagePath,
      sha256_hash: sha256,
      original_filename: file.name.slice(0, 255),
      mime_type: check.mime,
      size_bytes: file.size,
      metadata: { uploaded_via: "web", declared_type: file.type || null },
    };
  }

  const { collected_at, ...rest } = meta;
  const { data, error } = await supabase
    .from("evidence")
    .insert({ ...rest, ...(collected_at ? { collected_at } : {}), ...fileFields })
    .select("id")
    .single();
  if (error) {
    if (storagePath) {
      // Best effort: only admins may delete evidence objects, so an orphan may remain (logged).
      const { error: rmError } = await supabase.storage.from(BUCKET).remove([storagePath]);
      if (rmError) console.error("[storage] orphan evidence object:", storagePath);
    }
    return dbFail(error, "create evidence");
  }
  revalidatePath("/evidence");
  revalidatePath(`/investigations/${meta.case_id}`);
  redirect(`/evidence/${data.id}`);
}

export async function updateEvidenceAction(evidenceId: string, _prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const parsed = parseForm(evidenceUpdateSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { data, error } = await supabase.from("evidence").update(parsed.data).eq("id", evidenceId).select("id");
  if (error) return dbFail(error, "update evidence");
  if (!data?.length) return fail("Non hai i permessi per modificare questa evidenza.");
  revalidatePath(`/evidence/${evidenceId}`);
  return ok();
}

/** Recomputes the hash of the stored file and records the outcome (audited). */
export async function verifyIntegrityAction(evidenceId: string): Promise<ActionResult<{ ok: boolean }>> {
  await requireActiveOrg();
  if (!isUuid(evidenceId)) return fail("Evidenza non valida.");
  const supabase = await createClient();
  const { data: ev } = await supabase.from("evidence").select("id, storage_path, sha256_hash").eq("id", evidenceId).maybeSingle();
  if (!ev?.storage_path || !ev.sha256_hash) return fail("Questa evidenza non ha un file associato.");

  const { data: blob, error } = await supabase.storage.from(BUCKET).download(ev.storage_path);
  if (error || !blob) return fail("Impossibile leggere il file archiviato.");
  const computed = createHash("sha256").update(new Uint8Array(await blob.arrayBuffer())).digest("hex");
  const matches = computed === ev.sha256_hash;

  const { error: rpcError } = await supabase.rpc("record_integrity_check", {
    p_evidence: evidenceId,
    p_ok: matches,
    p_computed: computed,
  });
  if (rpcError) return dbFail(rpcError, "record integrity");
  revalidatePath(`/evidence/${evidenceId}`);
  return ok({ ok: matches });
}

export async function deleteEvidenceAction(evidenceId: string): Promise<ActionResult<unknown>> {
  await requireActiveOrg();
  const supabase = await createClient();
  const { data: ev } = await supabase.from("evidence").select("id, case_id, storage_path").eq("id", evidenceId).maybeSingle();
  if (!ev) return fail("Evidenza non trovata.");
  const { data, error } = await supabase.from("evidence").delete().eq("id", evidenceId).select("id");
  if (error) return dbFail(error, "delete evidence");
  if (!data?.length) return fail("Solo un amministratore dell'organizzazione può eliminare un'evidenza.");
  if (ev.storage_path) await supabase.storage.from(BUCKET).remove([ev.storage_path]);
  revalidatePath("/evidence");
  redirect(`/investigations/${ev.case_id}?tab=evidence`);
}
