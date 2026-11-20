"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <h1 className="text-lg font-semibold">Si è verificato un errore</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        L&apos;operazione non è stata completata. Nessun dettaglio tecnico viene mostrato per motivi di sicurezza; riprova o contatta un amministratore.
      </p>
      <Button onClick={reset}>Riprova</Button>
    </div>
  );
}
