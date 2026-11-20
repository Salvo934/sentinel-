import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { LOGIN_PATH } from "@/lib/auth/routes";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Narrow, client-safe view of the signed-in user. */
export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  emailConfirmedAt: string | null;
  /** Anonymous demo visitor ("Prova la demo"). */
  isAnonymous: boolean;
};

/**
 * Data Access Layer entry point for identity.
 *
 * Uses `auth.getUser()`, which asks the Supabase Auth server to validate the
 * session (so a revoked session is rejected), and is memoised per request.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  // Always render per request. Without this, a build without Supabase env
  // vars would prerender protected pages as a static redirect to /login.
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  const { user } = data;
  const fullName = user.user_metadata?.full_name;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: typeof fullName === "string" && fullName.trim() ? fullName.trim() : null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    isAnonymous: user.is_anonymous === true,
  };
});

/** Use in every protected layout, page, Server Action and Route Handler. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}
