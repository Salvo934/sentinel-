"use client";

import { Trash2 } from "lucide-react";

import { ConfirmAction } from "@/components/common/confirm-action";
import { Button } from "@/components/ui/button";
import { deleteFindingAction, deleteIocAction } from "@/features/osint/actions";

export function DeleteFindingButton({ id }: { id: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Elimina risultato">
          <Trash2 />
        </Button>
      }
      title="Eliminare il risultato OSINT?"
      description="L'operazione viene registrata nell'audit log."
      destructive
      confirmLabel="Elimina"
      onConfirm={() => deleteFindingAction(id)}
      successMessage="Risultato eliminato"
    />
  );
}

export function DeleteIocButton({ id }: { id: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Elimina indicatore">
          <Trash2 />
        </Button>
      }
      title="Eliminare l'indicatore?"
      description="Verranno eliminati anche i risultati delle analisi collegate."
      destructive
      confirmLabel="Elimina"
      onConfirm={() => deleteIocAction(id)}
      successMessage="Indicatore eliminato"
    />
  );
}
