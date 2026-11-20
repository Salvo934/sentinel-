"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/action-result";

/** Confirmation dialog for important or irreversible operations. */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Conferma",
  destructive = false,
  onConfirm,
  successMessage,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<ActionResult<unknown> | void>;
  successMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Annulla
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await onConfirm();
                if (result && !result.ok) {
                  toast.error(result.error);
                  return;
                }
                if (successMessage) toast.success(successMessage);
                setOpen(false);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
