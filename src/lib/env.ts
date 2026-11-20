import { z } from "zod";

/**
 * Public (browser-safe) configuration.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so they must be read with
 * literal `process.env.NEXT_PUBLIC_...` accesses. The secret key is never read
 * by the web app: Sentinel never needs the service role key.
 */
const publicEnvSchema = z.object({
  supabaseUrl: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL deve essere un URL valido" }),
  supabasePublishableKey: z
    .string({ message: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY) mancante" })
    .min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY non valida"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | undefined;

/**
 * True when real Supabase values are present. Lets the public pages render
 * (with a setup notice) on a fresh checkout instead of crashing.
 */
export function isSupabaseConfigured(): boolean {
  const parsed = publicEnvSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    // New Supabase "publishable" key; the legacy anon key is accepted as fallback.
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return parsed.success && !parsed.data.supabasePublishableKey.includes("xxxx");
}

export function getPublicEnv(): PublicEnv {
  if (cached) return cached;

  const parsed = publicEnvSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    // New Supabase "publishable" key; the legacy anon key is accepted as fallback.
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `- ${issue.message}`).join("\n");
    throw new Error(
      `Configurazione Supabase non valida. Copia .env.example in .env.local e compila i valori.\n${details}`,
    );
  }

  cached = parsed.data;
  return cached;
}
