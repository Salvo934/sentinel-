import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Create a new client per request — never share it across requests.
 * It acts as the signed-in user (RLS applies); it never uses the secret key.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
