const ENTITY: Record<string, string> = {
  case: "Caso",
  task: "Attività",
  evidence: "Evidenza",
  osint_finding: "Risultato OSINT",
  ioc: "IOC",
  timeline_event: "Evento timeline",
  risk: "Rischio",
  phishing_analysis: "Analisi phishing",
  domain_analysis: "Analisi dominio",
  report: "Report",
  organization: "Organizzazione",
  organization_member: "Membro",
  training: "Esercitazione",
  attack_mapping: "Tecnica ATT&CK",
};
const VERB: Record<string, string> = {
  created: "creato",
  updated: "aggiornato",
  deleted: "eliminato",
  integrity_checked: "verifica integrità",
  seeded: "dati demo caricati",
  cleared: "dati demo rimossi",
  role_changed: "ruolo modificato",
  added: "aggiunto",
};

/** "case.updated" → "Caso aggiornato"; "client.report.exported" → "Report esportato (app)". */
export function describeAction(action: string): string {
  const parts = action.split(".");
  const client = parts[0] === "client";
  const [entity, verb] = client ? [parts[1], parts.slice(2).join(".")] : [parts[0], parts.slice(1).join(".")];
  const clientVerbs: Record<string, string> = {
    exported: "esportato in PDF",
    downloaded: "scaricato",
    integrity_checked: "verifica integrità",
    submitted: "consegnato",
  };
  const e = ENTITY[entity ?? ""] ?? entity ?? "";
  const v = (client ? clientVerbs[verb ?? ""] : VERB[verb ?? ""]) ?? verb ?? "";
  return `${e} ${v}`.trim();
}
