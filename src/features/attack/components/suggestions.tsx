import { Crosshair } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { AttackSuggestion } from "../suggest";

/** Suggested ATT&CK techniques: hints with the reason, never conclusions. */
export function AttackSuggestions({ suggestions, renderAction }: { suggestions: AttackSuggestion[]; renderAction?: (s: AttackSuggestion) => ReactNode }) {
  if (suggestions.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Crosshair className="size-4" aria-hidden="true" /> Tecniche MITRE ATT&amp;CK suggerite
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Ipotesi da verificare: aiutano a dare un nome ai comportamenti osservati. Mappale su un caso solo se le evidenze le supportano.
      </p>
      <ul className="space-y-1.5">
        {suggestions.map((s) => (
          <li key={s.techniqueId} className="rounded-md border px-3 py-2 text-sm">
            <Link href={`/attack/${s.techniqueId}`} className="font-medium hover:underline">
              <span className="font-mono text-xs text-muted-foreground">{s.techniqueId}</span> {s.name}
            </Link>
            <p className="text-xs text-muted-foreground">{s.reason}</p>
            {renderAction ? <div className="mt-2">{renderAction(s)}</div> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
