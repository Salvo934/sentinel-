"use client";

import { FlaskConical, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/common/confirm-action";
import { selectClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";

import { clearDemoAction, seedDemoAction, setMemberRoleAction } from "./actions";

export function DemoControls({ loaded }: { loaded: boolean }) {
  return loaded ? (
    <ConfirmAction
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 /> Rimuovi dati demo
        </Button>
      }
      title="Rimuovere tutti i dati demo?"
      description="Verranno eliminati solo i dati contrassegnati come «Demo» (casi, evidenze dimostrative, IOC, analisi, fonti). I tuoi dati reali non vengono toccati."
      confirmLabel="Rimuovi"
      destructive
      onConfirm={clearDemoAction}
      successMessage="Dati demo rimossi"
    />
  ) : (
    <ConfirmAction
      trigger={
        <Button size="sm">
          <FlaskConical /> Carica dati demo
        </Button>
      }
      title="Caricare i dati demo?"
      description="Verranno creati casi, evidenze, IOC, risultati OSINT, analisi e un report fittizi, tutti etichettati «Demo» e rimovibili in un clic."
      confirmLabel="Carica"
      onConfirm={seedDemoAction}
      successMessage="Dati demo caricati"
    />
  );
}

export function RoleSelect({ userId, role, disabled }: { userId: string; role: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Ruolo"
      defaultValue={role}
      disabled={disabled || pending}
      className={`${selectClass} h-7 w-36 text-xs`}
      onChange={(e) =>
        start(async () => {
          const res = await setMemberRoleAction(userId, e.target.value as "admin" | "analyst" | "trainee");
          if (res.ok) toast.success("Ruolo aggiornato");
          else {
            toast.error(res.error);
            e.target.value = role;
          }
        })
      }
    >
      <option value="admin">Administrator</option>
      <option value="analyst">Analyst</option>
      <option value="trainee">Trainee</option>
    </select>
  );
}
