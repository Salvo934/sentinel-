"use server";

import { redirect } from "next/navigation";

import { LOGIN_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Action (Next.js checks the Origin header, so it is CSRF-safe).
 * Revokes the current session on the Auth server and clears the cookies.
 */
export async function signOutAction(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(`${LOGIN_PATH}?signed_out=1`);
}
