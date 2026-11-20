import { FileLock2, GraduationCap, Radar } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { FormAlert } from "@/components/forms/form-alert";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { isSupabaseConfigured } from "@/lib/env";

const highlights = [
  { icon: Radar, text: "Casi investigativi, OSINT, IOC, domini e phishing in un unico ambiente" },
  { icon: FileLock2, text: "Evidenze private con hash SHA-256 e audit log immutabile" },
  { icon: GraduationCap, text: "Training Academy con scenari realistici e soluzioni guidate" },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-sidebar-primary/15 blur-3xl"
        />
        <Link
          href="/"
          className="relative w-fit rounded-md outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/60"
        >
          <Logo inverted />
        </Link>
        <div className="relative max-w-md space-y-8">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
            Analizza, verifica, documenta. Distingui sempre i fatti dalle ipotesi.
          </h2>
          <ul className="space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-sidebar-foreground/85">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative max-w-md text-xs text-sidebar-foreground/60">
          Sentinel Intelligence è uno strumento di analisi e formazione. Non sostituisce il giudizio professionale
          dell&apos;analista e non certifica la validità probatoria delle evidenze.
        </p>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Link
            href="/"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:invisible"
          >
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <div className="w-full max-w-sm space-y-6">
            {isSupabaseConfigured() ? null : (
              <FormAlert tone="info" title="Supabase non configurato">
                Puoi navigare le pagine, ma login e registrazione non funzionano finché non compili
                NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (vedi README).
              </FormAlert>
            )}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
