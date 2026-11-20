import type { Metadata } from "next";

import { AuthCard } from "@/features/auth/components/auth-card";
import { UpdatePasswordForm } from "@/features/auth/components/update-password-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nuova password" };

export default async function UpdatePasswordPage() {
  // Reached through the recovery link (/auth/confirm creates the session)
  // or by a signed-in user who wants to change their password.
  const user = await requireUser();

  return (
    <AuthCard title="Imposta una nuova password" description={`Account: ${user.email}`}>
      <UpdatePasswordForm />
    </AuthCard>
  );
}
