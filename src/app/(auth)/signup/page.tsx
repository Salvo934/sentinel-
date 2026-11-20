import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { SignUpForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = { title: "Crea account" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Crea il tuo account"
      description="Dopo la registrazione riceverai un'email per confermare l'indirizzo."
      footer={
        <>
          Hai già un account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Accedi
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
