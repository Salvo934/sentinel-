/**
 * Domain vocabulary shared by UI, validation and reports.
 * Values mirror the PostgreSQL enums in supabase/migrations/*_foundations.sql.
 */

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "teal";

function entries<T extends string>(map: Record<T, string>) {
  return Object.entries(map) as [T, string][];
}

export const CASE_CATEGORIES = {
  osint_investigation: "OSINT Investigation",
  cyber_threat_intelligence: "Cyber Threat Intelligence",
  phishing_investigation: "Phishing Investigation",
  domain_investigation: "Domain Investigation",
  digital_risk_assessment: "Digital Risk Assessment",
  corporate_due_diligence: "Corporate Due Diligence",
  brand_impersonation: "Brand Impersonation",
  security_incident_analysis: "Security Incident Analysis",
  investigation_training: "Investigation Training",
} as const;
export type CaseCategory = keyof typeof CASE_CATEGORIES;
export const CASE_CATEGORY_VALUES = Object.keys(CASE_CATEGORIES) as [CaseCategory, ...CaseCategory[]];

export const CASE_STATUSES = {
  open: "Aperto",
  in_progress: "In lavorazione",
  on_hold: "In attesa",
  closed: "Chiuso",
  archived: "Archiviato",
} as const;
export type CaseStatus = keyof typeof CASE_STATUSES;
export const CASE_STATUS_VALUES = Object.keys(CASE_STATUSES) as [CaseStatus, ...CaseStatus[]];
export const CASE_STATUS_TONE: Record<CaseStatus, Tone> = {
  open: "info",
  in_progress: "teal",
  on_hold: "warning",
  closed: "success",
  archived: "neutral",
};

export const PRIORITIES = { low: "Bassa", medium: "Media", high: "Alta", critical: "Critica" } as const;
export type Priority = keyof typeof PRIORITIES;
export const PRIORITY_VALUES = Object.keys(PRIORITIES) as [Priority, ...Priority[]];
export const PRIORITY_TONE: Record<Priority, Tone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
};

export const RISK_LEVELS = {
  informational: "Informativo",
  low: "Basso",
  medium: "Medio",
  high: "Alto",
  critical: "Critico",
} as const;
export type RiskLevel = keyof typeof RISK_LEVELS;
export const RISK_LEVEL_VALUES = Object.keys(RISK_LEVELS) as [RiskLevel, ...RiskLevel[]];
export const RISK_TONE: Record<RiskLevel, Tone> = {
  informational: "neutral",
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

export const TASK_STATUSES = {
  todo: "Da fare",
  in_progress: "In corso",
  done: "Completata",
  cancelled: "Annullata",
} as const;
export type TaskStatus = keyof typeof TASK_STATUSES;
export const TASK_STATUS_VALUES = Object.keys(TASK_STATUSES) as [TaskStatus, ...TaskStatus[]];

/** The platform must never confuse hypotheses with established facts. */
export const INFO_STATUSES = {
  verified_fact: "Fatto verificato",
  to_verify: "Informazione da verificare",
  hypothesis: "Ipotesi analitica",
  contradictory: "Informazione contraddittoria",
  unavailable: "Dato non disponibile",
} as const;
export type InfoStatus = keyof typeof INFO_STATUSES;
export const INFO_STATUS_VALUES = Object.keys(INFO_STATUSES) as [InfoStatus, ...InfoStatus[]];
export const INFO_STATUS_TONE: Record<InfoStatus, Tone> = {
  verified_fact: "success",
  to_verify: "warning",
  hypothesis: "info",
  contradictory: "danger",
  unavailable: "neutral",
};

/** Admiralty (NATO) source reliability scale. */
export const RELIABILITY = {
  A: "A — Completamente affidabile",
  B: "B — Generalmente affidabile",
  C: "C — Abbastanza affidabile",
  D: "D — Generalmente non affidabile",
  E: "E — Inaffidabile",
  F: "F — Affidabilità non valutabile",
} as const;
export type Reliability = keyof typeof RELIABILITY;
export const RELIABILITY_VALUES = Object.keys(RELIABILITY) as [Reliability, ...Reliability[]];

export const CONFIDENCE = { low: "Bassa", moderate: "Moderata", high: "Alta" } as const;
export type Confidence = keyof typeof CONFIDENCE;
export const CONFIDENCE_VALUES = Object.keys(CONFIDENCE) as [Confidence, ...Confidence[]];

export const EVIDENCE_TYPES = {
  document: "Documento",
  screenshot: "Screenshot",
  text: "File di testo",
  pdf: "PDF",
  email: "Email",
  web_capture: "Acquisizione web",
  dataset: "Dataset",
  other: "Altro",
} as const;
export type EvidenceType = keyof typeof EVIDENCE_TYPES;
export const EVIDENCE_TYPE_VALUES = Object.keys(EVIDENCE_TYPES) as [EvidenceType, ...EvidenceType[]];

export const IOC_TYPES = {
  ipv4: "IPv4",
  ipv6: "IPv6",
  domain: "Dominio",
  url: "URL",
  sha256: "SHA-256",
  sha1: "SHA-1",
  md5: "MD5",
} as const;
export type IocType = keyof typeof IOC_TYPES;
export const IOC_TYPE_VALUES = Object.keys(IOC_TYPES) as [IocType, ...IocType[]];

export const VERDICTS = {
  undetermined: "Non determinato",
  benign: "Benigno",
  suspicious: "Sospetto",
  malicious: "Malevolo",
} as const;
export type Verdict = keyof typeof VERDICTS;
export const VERDICT_VALUES = Object.keys(VERDICTS) as [Verdict, ...Verdict[]];
export const VERDICT_TONE: Record<Verdict, Tone> = {
  undetermined: "neutral",
  benign: "success",
  suspicious: "warning",
  malicious: "danger",
};

export const TLP = {
  clear: "TLP:CLEAR",
  green: "TLP:GREEN",
  amber: "TLP:AMBER",
  amber_strict: "TLP:AMBER+STRICT",
  red: "TLP:RED",
} as const;
export type Tlp = keyof typeof TLP;
export const TLP_VALUES = Object.keys(TLP) as [Tlp, ...Tlp[]];

export const REPORT_TYPES = {
  osint_investigation: "OSINT Investigation Report",
  cyber_threat_intelligence: "Cyber Threat Intelligence Report",
  phishing_investigation: "Phishing Investigation Report",
  domain_investigation: "Domain Investigation Report",
  digital_risk_assessment: "Digital Risk Assessment Report",
  corporate_due_diligence: "Corporate Due Diligence Report",
  executive_brief: "Executive Intelligence Brief",
} as const;
export type ReportType = keyof typeof REPORT_TYPES;
export const REPORT_TYPE_VALUES = Object.keys(REPORT_TYPES) as [ReportType, ...ReportType[]];

export const CLASSIFICATIONS = {
  public: "Pubblico",
  internal: "Uso interno",
  confidential: "Riservato",
  restricted: "Riservatissimo",
} as const;
export type Classification = keyof typeof CLASSIFICATIONS;
export const CLASSIFICATION_VALUES = Object.keys(CLASSIFICATIONS) as [Classification, ...Classification[]];

export const ORG_ROLES = { admin: "Administrator", analyst: "Analyst", trainee: "Trainee" } as const;
export type OrgRole = keyof typeof ORG_ROLES;

export const EVENT_CATEGORIES = {
  infrastructure: "Infrastruttura",
  communication: "Comunicazione",
  corporate: "Societario",
  technical: "Tecnico",
  incident: "Incidente",
  analysis: "Analisi",
  other: "Altro",
} as const;
export type EventCategory = keyof typeof EVENT_CATEGORIES;
export const EVENT_CATEGORY_VALUES = Object.keys(EVENT_CATEGORIES) as [EventCategory, ...EventCategory[]];

export const SOURCE_TYPES = {
  public_registry: "Registro pubblico",
  dns: "DNS",
  rdap_whois: "RDAP / WHOIS",
  certificate_transparency: "Certificate Transparency",
  news_media: "Stampa / media",
  corporate_website: "Sito aziendale",
  social_media: "Social media",
  threat_intel_feed: "Feed di threat intelligence",
  government: "Fonte istituzionale",
  document: "Documento",
  other: "Altro",
} as const;
export type SourceType = keyof typeof SOURCE_TYPES;
export const SOURCE_TYPE_VALUES = Object.keys(SOURCE_TYPES) as [SourceType, ...SourceType[]];

export const options = {
  categories: entries(CASE_CATEGORIES),
  statuses: entries(CASE_STATUSES),
  priorities: entries(PRIORITIES),
  risks: entries(RISK_LEVELS),
  taskStatuses: entries(TASK_STATUSES),
  infoStatuses: entries(INFO_STATUSES),
  reliability: entries(RELIABILITY),
  confidence: entries(CONFIDENCE),
  evidenceTypes: entries(EVIDENCE_TYPES),
  iocTypes: entries(IOC_TYPES),
  verdicts: entries(VERDICTS),
  tlp: entries(TLP),
  reportTypes: entries(REPORT_TYPES),
  classifications: entries(CLASSIFICATIONS),
  eventCategories: entries(EVENT_CATEGORIES),
  sourceTypes: entries(SOURCE_TYPES),
};

export function label<T extends Record<string, string>>(map: T, value: string | null | undefined): string {
  if (!value) return "—";
  return (map as Record<string, string>)[value] ?? value;
}
