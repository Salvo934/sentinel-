import { Bot } from "lucide-react";
import type { Metadata } from "next";

import { PlannedModule } from "@/components/common/planned-module";

export const metadata: Metadata = { title: "AI Assistant" };

export default function AssistantPage() {
  return (
    <PlannedModule
      title="AI Investigation Assistant"
      phase="Fase 5"
      icon={Bot}
      description="Assistente opzionale per formazione e analisi, disattivabile completamente."
      features={[
        "Spiegazione dei risultati tecnici e guida metodologica",
        "Suggerimento delle verifiche successive e delle informazioni mancanti",
        "Controllo della struttura dei report e spiegazione degli errori nelle esercitazioni",
        "Regole: nessuna fonte o evidenza inventata, nessuna classificazione di persone come sospette, distinzione tra ipotesi e fatti",
      ]}
      ready="La chiave AI_PROVIDER_API_KEY è prevista solo lato server (.env.example). Nessuna chiamata a modelli AI è attiva in questa versione."
    />
  );
}
