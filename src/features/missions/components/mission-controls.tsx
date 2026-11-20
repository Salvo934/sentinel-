"use client";

import { Flag, Link2, Loader2, Play, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/common/confirm-action";
import { selectClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";

import { abandonMissionAction, completeMissionAction, linkMissionCaseAction, startMissionAction } from "../actions";
import type { Debrief } from "../types";

export function StartMissionButton({ missionId, slug, again = false }: { missionId: string; slug: string; again?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={again ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startMissionAction(missionId, slug);
          if (!res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : again ? <RotateCcw /> : <Play />} {again ? "Rifai la missione" : "Inizia la missione"}
    </Button>
  );
}

export function LinkCaseForm({ runId, slug, cases }: { runId: string; slug: string; cases: (readonly [string, string])[] }) {
  const [value, setValue] = useState(cases[0]?.[0] ?? "");
  const [pending, start] = useTransition();
  if (!cases.length) {
    return <p className="text-sm text-muted-foreground">Non hai ancora casi di questa tipologia: crealo dal pulsante del passo 1, poi torna qui.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Caso da collegare" className={`${selectClass} max-w-md`} value={value} onChange={(e) => setValue(e.target.value)}>
        {cases.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={pending || !value}
        onClick={() =>
          start(async () => {
            const res = await linkMissionCaseAction(runId, slug, value);
            if (res.ok) toast.success("Caso collegato alla missione");
            else toast.error(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Link2 />} Collega
      </Button>
    </div>
  );
}

export function CompleteMissionButton({ runId, slug }: { runId: string; slug: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await completeMissionAction(runId, slug);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Missione completata: leggi il debriefing");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Flag />} Chiudi la missione e leggi il debriefing
    </Button>
  );
}

export function AbandonMissionButton({ runId, slug }: { runId: string; slug: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm">
          Annulla missione
        </Button>
      }
      title="Annullare la missione in corso?"
      description="I progressi della missione verranno eliminati. Il caso collegato e il lavoro fatto nei moduli restano."
      destructive
      confirmLabel="Annulla missione"
      onConfirm={() => abandonMissionAction(runId, slug)}
      successMessage="Missione annullata"
    />
  );
}

export type { Debrief };
