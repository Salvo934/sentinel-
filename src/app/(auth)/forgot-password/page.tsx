import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Recupera password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Recupera la password"
      description="Indica l'email del tuo account: ti invieremo un link per impostare una nuova password."
      footer={
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Torna al login
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
