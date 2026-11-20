"use client";

import { Fingerprint, Loader2, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/common/confirm-action";
import { Button } from "@/components/ui/button";
import { deleteEvidenceAction, verifyIntegrityAction } from "@/features/evidence/actions";

export function VerifyIntegrityButton({ evidenceId }: { evidenceId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await verifyIntegrityAction(evidenceId);
          if (!res.ok) toast.error(res.error);
          else if (res.data.ok) toast.success("Integrità confermata: l'hash coincide con quello registrato.");
          else toast.error("ATTENZIONE: l'hash calcolato non coincide con quello registrato.");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Fingerprint />} Verifica integrità
    </Button>
  );
}

export function DeleteEvidenceButton({ evidenceId }: { evidenceId: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 /> Elimina
        </Button>
      }
      title="Eliminare l'evidenza?"
      description="Il record e il file archiviato verranno eliminati in modo irreversibile. L'operazione resta tracciata nell'audit log."
      confirmLabel="Elimina definitivamente"
      destructive
      onConfirm={() => deleteEvidenceAction(evidenceId)}
    />
  );
}
