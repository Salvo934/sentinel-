"use client";

import { Archive, ArchiveRestore, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/common/confirm-action";
import { selectClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { deleteCaseAction, deleteEventAction, deleteTaskAction, setCaseStatusAction, setTaskStatusAction } from "@/features/cases/actions";
import type { CaseStatus, TaskStatus } from "@/lib/domain";
import { TASK_STATUSES } from "@/lib/domain";

export function CaseStatusControls({ caseId, status, isAdmin }: { caseId: string; status: CaseStatus; isAdmin: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "closed" && status !== "archived" ? (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <CheckCircle2 /> Chiudi caso
            </Button>
          }
          title="Chiudere il caso?"
          description="La data di chiusura verrà registrata. Potrai riaprirlo in seguito."
          confirmLabel="Chiudi caso"
          onConfirm={() => setCaseStatusAction(caseId, "closed")}
          successMessage="Caso chiuso"
        />
      ) : null}
      {status === "closed" ? (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <RotateCcw /> Riapri
            </Button>
          }
          title="Riaprire il caso?"
          description="Lo stato tornerà a «In lavorazione» e la data di chiusura verrà rimossa."
          onConfirm={() => setCaseStatusAction(caseId, "in_progress")}
          successMessage="Caso riaperto"
        />
      ) : null}
      {status !== "archived" ? (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <Archive /> Archivia
            </Button>
          }
          title="Archiviare il caso?"
          description="Un caso archiviato diventa di sola lettura (attività, evidenze, timeline e report non sono modificabili)."
          confirmLabel="Archivia"
          onConfirm={() => setCaseStatusAction(caseId, "archived")}
          successMessage="Caso archiviato"
        />
      ) : (
        <>
          <ConfirmAction
            trigger={
              <Button variant="outline" size="sm">
                <ArchiveRestore /> Ripristina
              </Button>
            }
            title="Ripristinare il caso?"
            description="Il caso tornerà nello stato «Chiuso» e sarà nuovamente modificabile."
            onConfirm={() => setCaseStatusAction(caseId, "closed")}
            successMessage="Caso ripristinato"
          />
          {isAdmin ? (
            <ConfirmAction
              trigger={
                <Button variant="destructive" size="sm">
                  <Trash2 /> Elimina definitivamente
                </Button>
              }
              title="Eliminare definitivamente il caso?"
              description={
                <>
                  Verranno eliminati anche attività, evidenze, timeline e report collegati. L&apos;operazione è
                  irreversibile; resterà traccia solo nell&apos;audit log.
                </>
              }
              confirmLabel="Elimina"
              destructive
              onConfirm={() => deleteCaseAction(caseId)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

export function TaskStatusSelect({ caseId, taskId, status, disabled }: { caseId: string; taskId: string; status: TaskStatus; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Stato attività"
      className={`${selectClass} h-7 w-36 text-xs`}
      defaultValue={status}
      disabled={disabled || pending}
      onChange={(e) =>
        start(async () => {
          await setTaskStatusAction(caseId, taskId, e.target.value as TaskStatus);
          toast.success("Stato aggiornato");
        })
      }
    >
      {Object.entries(TASK_STATUSES).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function DeleteTaskButton({ caseId, taskId }: { caseId: string; taskId: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Elimina attività">
          <Trash2 />
        </Button>
      }
      title="Eliminare l'attività?"
      description="L'operazione viene registrata nell'audit log."
      destructive
      confirmLabel="Elimina"
      onConfirm={() => deleteTaskAction(caseId, taskId)}
      successMessage="Attività eliminata"
    />
  );
}

export function DeleteEventButton({ caseId, eventId }: { caseId: string; eventId: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Elimina evento">
          <Trash2 />
        </Button>
      }
      title="Eliminare l'evento dalla timeline?"
      description="L'operazione viene registrata nell'audit log."
      destructive
      confirmLabel="Elimina"
      onConfirm={() => deleteEventAction(caseId, eventId)}
      successMessage="Evento eliminato"
    />
  );
}
