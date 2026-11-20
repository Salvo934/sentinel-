import type { Metadata } from "next";
import Link from "next/link";

import { FormAlert } from "@/components/forms/form-alert";
import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeRedirectPath } from "@/lib/auth/routes";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Accedi" };

const NOTICES = {
  link_invalid: { tone: "error", text: "Il link non è valido o è scaduto. Richiedine uno nuovo." },
  signed_out: { tone: "info", text: "Sei uscito dal tuo account." },
} as const;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(firstParam(params.next));
  const notice =
    firstParam(params.error) === "link_invalid"
      ? NOTICES.link_invalid
      : firstParam(params.signed_out)
        ? NOTICES.signed_out
        : null;

  return (
    <AuthCard
      title="Accedi"
      description="Inserisci le tue credenziali per accedere a Sentinel Intelligence."
      footer={
        <>
          Non hai un account?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Registrati
          </Link>
        </>
      }
    >
      {notice ? (
        <FormAlert tone={notice.tone} className="mb-2">
          {notice.text}
        </FormAlert>
      ) : null}
      <LoginForm next={next} />
    </AuthCard>
  );
}
