"use client";

import { Loader2, Play, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/common/confirm-action";
import { Button } from "@/components/ui/button";

import { discardAttemptAction, startAttemptAction } from "../actions";

export function StartAttemptButton({ scenarioId, slug, again = false }: { scenarioId: string; slug: string; again?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={again ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startAttemptAction(scenarioId, slug);
          if (!res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : again ? <RotateCcw /> : <Play />} {again ? "Nuovo tentativo" : "Inizia esercitazione"}
    </Button>
  );
}

export function DiscardAttemptButton({ attemptId, slug }: { attemptId: string; slug: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm">
          Annulla tentativo
        </Button>
      }
      title="Annullare il tentativo in corso?"
      description="Le risposte salvate verranno eliminate."
      destructive
      confirmLabel="Annulla tentativo"
      onConfirm={() => discardAttemptAction(attemptId, slug)}
      successMessage="Tentativo annullato"
    />
  );
}
