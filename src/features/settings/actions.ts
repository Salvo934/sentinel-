"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { dbFail, parseForm } from "@/lib/actions";
import { requireActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation";

type Prev = ActionResult<unknown> | null;

export async function updateProfileAction(_prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  const { user } = await requireActiveOrg();
  const parsed = parseForm(profileSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.full_name }).eq("id", user.id);
  if (error) return dbFail(error, "update profile");
  revalidatePath("/", "layout");
  return ok();
}

export async function renameOrganizationAction(_prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const parsed = parseForm(z.object({ name: z.string().trim().min(2).max(120) }), formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").update({ name: parsed.data.name }).eq("id", active.organizationId).select("id");
  if (error) return dbFail(error, "rename org");
  if (!data?.length) return fail("Solo un amministratore può rinominare l'organizzazione.");
  revalidatePath("/", "layout");
  return ok();
}

export async function addMemberAction(_prev: Prev, formData: FormData): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const parsed = parseForm(z.object({ email: z.email("Email non valida"), role: z.enum(["admin", "analyst", "trainee"]) }), formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_member_by_email", { p_org: active.organizationId, p_email: parsed.data.email, p_role: parsed.data.role });
  // Same message whether or not the email exists for non-admins (42501 first).
  if (error) return error.code === "P0002" ? fail("Nessun utente registrato con questa email: chiedigli di registrarsi prima.") : dbFail(error, "add member");
  revalidatePath("/settings");
  return ok();
}

export async function setMemberRoleAction(userId: string, role: "admin" | "analyst" | "trainee"): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", { p_org: active.organizationId, p_user: userId, p_role: role });
  if (error) return error.code === "23514" ? fail("L'organizzazione deve avere almeno un amministratore.") : dbFail(error, "set role");
  revalidatePath("/settings");
  return ok();
}

export async function seedDemoAction(): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const supabase = await createClient();
  const { error } = await supabase.rpc("seed_demo_data", { p_org: active.organizationId });
  if (error) return error.code === "23505" ? fail("I dati demo sono già caricati.") : dbFail(error, "seed demo");
  // ATT&CK mappings for the demo cases (no-op if the ATT&CK dataset is not loaded).
  const { error: attackError } = await supabase.rpc("seed_demo_attack", { p_org: active.organizationId });
  if (attackError) console.error("[db] seed demo attack:", attackError.code);
  revalidatePath("/", "layout");
  return ok();
}

export async function clearDemoAction(): Promise<ActionResult<unknown>> {
  const { active } = await requireActiveOrg();
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_demo_data", { p_org: active.organizationId });
  if (error) return dbFail(error, "clear demo");
  revalidatePath("/", "layout");
  return ok();
}
