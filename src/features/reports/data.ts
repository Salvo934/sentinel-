import "server-only";

import { CASE_CATEGORIES, CONFIDENCE, EVENT_CATEGORIES, EVIDENCE_TYPES, INFO_STATUSES, IOC_TYPES, VERDICTS } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { defang } from "@/lib/indicators";
import { createClient } from "@/lib/supabase/server";

export type ReportRecord = {
  id: string;
  case_id: string;
  report_key: string;
  version: number;
  report_type: string;
  title: string;
  classification: string;
  status: "draft" | "final";
  content: Record<string, string | undefined>;
  storage_path: string | null;
  is_demo: boolean;
  created_by: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Annex = { heading: string; head: string[]; rows: string[][]; note?: string };

export type ReportBundle = {
  report: ReportRecord;
  caseInfo: { id: string; case_ref: string; title: string; category: string; objective: string | null; organization_id: string; status: string; risk_level: string };
  analyst: string;
  annexes: Annex[];
  versions: { id: string; version: number; status: string; updated_at: string }[];
};

/**
 * Collects everything a report may contain. Annexes are generated exclusively
 * from database rows: when a table is empty the report says so, it never
 * fills the gap with invented content.
 */
export async function getReportBundle(reportId: string): Promise<ReportBundle | null> {
  const supabase = await createClient();
  const { data: report } = await supabase.from("reports").select("*").eq("id", reportId).maybeSingle();
  if (!report) return null;
  const caseId = report.case_id as string;

  const [caseRes, evidenceRes, findingsRes, iocRes, eventsRes, versionsRes, authorRes, phishingRes, domainRes] = await Promise.all([
    supabase.from("cases").select("id, case_ref, title, category, objective, organization_id, status, risk_level").eq("id", caseId).single(),
    supabase.from("evidence").select("title, evidence_type, source, collected_at, sha256_hash, reliability, verification_status").eq("case_id", caseId).order("collected_at"),
    supabase.from("osint_findings").select("title, source_name, source_url, collected_at, acquisition_method, reliability, info_status").eq("case_id", caseId).order("collected_at"),
    supabase.from("ioc_indicators").select("indicator_type, indicator_value, source, confidence, analyst_verdict").eq("case_id", caseId).order("created_at"),
    supabase.from("investigation_events").select("title, category, event_at, recorded_at, source, info_status").eq("case_id", caseId).order("event_at"),
    supabase.from("reports").select("id, version, status, updated_at").eq("report_key", report.report_key).order("version", { ascending: false }),
    report.created_by ? supabase.from("profiles").select("full_name").eq("id", report.created_by).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("phishing_analyses").select("title, verdict, confidence, created_at").eq("case_id", caseId),
    supabase.from("domain_analyses").select("domain, data_mode, risk_level, created_at").eq("case_id", caseId),
  ]);
  if (!caseRes.data) return null;

  const evidence = evidenceRes.data ?? [];
  const findings = findingsRes.data ?? [];
  const sources = new Map<string, string>();
  findings.forEach((f) => sources.set(f.source_name, f.source_url ?? ""));
  evidence.forEach((e) => e.source && !sources.has(e.source) && sources.set(e.source, ""));

  const annexes: Annex[] = [
    {
      heading: "Fonti consultate",
      head: ["Fonte", "URL (non visitato dal sistema)"],
      rows: [...sources.entries()].map(([name, url]) => [name, url ? defang(url) : "—"]),
    },
    {
      heading: "Evidenze",
      head: ["Titolo", "Tipo", "Acquisita", "Affid.", "Verifica", "SHA-256"],
      rows: evidence.map((e) => [
        e.title,
        EVIDENCE_TYPES[e.evidence_type as keyof typeof EVIDENCE_TYPES] ?? e.evidence_type,
        formatDateTime(e.collected_at),
        e.reliability,
        INFO_STATUSES[e.verification_status as keyof typeof INFO_STATUSES],
        e.sha256_hash ?? "nessun file",
      ]),
      note: "L'hash consente controlli di integrità ma non attesta da solo la catena di custodia o la validità probatoria.",
    },
    {
      heading: "Risultati OSINT",
      head: ["Risultato", "Fonte", "Raccolto", "Metodo", "Affid.", "Stato"],
      rows: findings.map((f) => [
        f.title,
        f.source_name,
        formatDateTime(f.collected_at),
        f.acquisition_method,
        f.reliability,
        INFO_STATUSES[f.info_status as keyof typeof INFO_STATUSES],
      ]),
    },
    {
      heading: "Indicatori di compromissione",
      head: ["Tipo", "Indicatore (defanged)", "Fonte", "Confidenza", "Verdetto analista"],
      rows: (iocRes.data ?? []).map((i) => [
        IOC_TYPES[i.indicator_type as keyof typeof IOC_TYPES],
        defang(i.indicator_value),
        i.source ?? "—",
        CONFIDENCE[i.confidence as keyof typeof CONFIDENCE],
        VERDICTS[i.analyst_verdict as keyof typeof VERDICTS],
      ]),
    },
    {
      heading: "Cronologia degli eventi",
      head: ["Data evento", "Evento", "Categoria", "Acquisito", "Stato"],
      rows: (eventsRes.data ?? []).map((e) => [
        formatDateTime(e.event_at),
        e.title,
        EVENT_CATEGORIES[e.category as keyof typeof EVENT_CATEGORIES],
        formatDateTime(e.recorded_at),
        INFO_STATUSES[e.info_status as keyof typeof INFO_STATUSES],
      ]),
    },
  ];
  if ((phishingRes.data ?? []).length) {
    annexes.push({
      heading: "Analisi phishing collegate",
      head: ["Analisi", "Verdetto", "Confidenza", "Data"],
      rows: phishingRes.data!.map((p) => [p.title, VERDICTS[p.verdict as keyof typeof VERDICTS], CONFIDENCE[p.confidence as keyof typeof CONFIDENCE], formatDateTime(p.created_at)]),
    });
  }
  if ((domainRes.data ?? []).length) {
    annexes.push({
      heading: "Analisi di domini collegate",
      head: ["Dominio", "Dati", "Rischio (analista)", "Data"],
      rows: domainRes.data!.map((d) => [d.domain, d.data_mode === "live" ? "reali" : "simulati", d.risk_level ?? "—", formatDateTime(d.created_at)]),
    });
  }

  return {
    report: report as ReportRecord,
    caseInfo: { ...caseRes.data, category: CASE_CATEGORIES[caseRes.data.category as keyof typeof CASE_CATEGORIES] },
    analyst: (authorRes.data?.full_name as string | undefined) ?? "—",
    annexes,
    versions: versionsRes.data ?? [],
  };
}
