import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

/**
 * Supabase client for Client Components.
 * Uses the publishable key + the user's session cookie, so every query is
 * subject to Row Level Security.
 */
export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

export const NOT_CONFIGURED_MESSAGE =
  "Supabase non è configurato: compila .env.local e riavvia il server di sviluppo.";

/** Like createClient(), but returns null instead of throwing when env is missing. */
export function tryCreateClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}
