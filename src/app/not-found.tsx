import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Elemento non trovato o non accessibile</h1>
      <p className="max-w-md text-sm text-muted-foreground">La risorsa non esiste oppure non hai i permessi per visualizzarla.</p>
      <Button asChild>
        <Link href="/dashboard">Torna alla dashboard</Link>
      </Button>
    </div>
  );
}
