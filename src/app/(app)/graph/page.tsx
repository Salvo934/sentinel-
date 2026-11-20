import { Network } from "lucide-react";
import type { Metadata } from "next";

import { PlannedModule } from "@/components/common/planned-module";

export const metadata: Metadata = { title: "Investigation Graph" };

export default function GraphPage() {
  return (
    <PlannedModule
      title="Investigation Graph"
      phase="Fase 3"
      icon={Network}
      description="Rappresentazione visuale dei collegamenti investigativi con React Flow."
      features={[
        "Nodi: organizzazione, dominio, IP, URL, IOC, evento, caso, evidenza",
        "Creazione di collegamenti con tipologia, descrizione, fonte, attendibilità e data",
        "Distinzione grafica tra relazioni verificate e ipotetiche",
        "Zoom, ricerca, filtri, salvataggio delle posizioni, esportazione del grafo",
      ]}
      ready="Le tabelle investigation_entities ed entity_relationships (con posizioni, confidenza, stato dell'informazione ed evidenza collegata) sono già create, protette da RLS e verificate da vincoli di coerenza sul caso."
    />
  );
}
