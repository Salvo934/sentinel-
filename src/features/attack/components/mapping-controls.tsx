"use client";

import { Trash2 } from "lucide-react";

import { ConfirmAction } from "@/components/common/confirm-action";
import { Button } from "@/components/ui/button";

import { deleteMappingAction } from "../actions";

export function DeleteMappingButton({ mappingId, caseId }: { mappingId: string; caseId: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Rimuovi tecnica dal caso">
          <Trash2 />
        </Button>
      }
      title="Rimuovere la tecnica dal caso?"
      description="La rimozione viene registrata nell'audit log."
      destructive
      confirmLabel="Rimuovi"
      onConfirm={() => deleteMappingAction(mappingId, caseId)}
      successMessage="Tecnica rimossa"
    />
  );
}
