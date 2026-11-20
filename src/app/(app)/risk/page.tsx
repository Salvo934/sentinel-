import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

import { PlannedModule } from "@/components/common/planned-module";

export const metadata: Metadata = { title: "Risk Assessment" };

export default function RiskPage() {
  return (
    <PlannedModule
      title="Risk Assessment"
      phase="Fase 4"
      icon={ShieldAlert}
      description="Valutazione dei rischi con matrice 5×5 configurabile e registro dei rischi."
      features={[
        "Registro dei rischi: asset, minaccia, vulnerabilità, controlli, responsabile, scadenza",
        "Matrice 5×5 interattiva con scale e soglie configurabili",
        "Distinzione tra punteggio numerico e valutazione professionale",
        "Report: Risk Assessment, Risk Register, Mitigation Plan, Executive Risk Summary",
      ]}
      ready="La tabella risk_assessments è già creata con probabilità/impatto 1–5, rischio inerente e residuo calcolati, valutazione dell'analista separata, RLS e audit log. Nel frattempo il livello di rischio dei casi è gestito come valutazione motivata dell'analista."
    />
  );
}
