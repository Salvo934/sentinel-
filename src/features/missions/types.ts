export type MissionCheck = { type: string; [k: string]: unknown };
export type MissionQuiz =
  | { type: "single" | "multi"; prompt: string; options: { value: string; label: string }[] }
  | { type: "text"; prompt: string; min_length?: number };

export type MissionStep = {
  id: string;
  title: string;
  instruction: string;
  module?: { href: string; label: string };
  think?: string[];
  check?: MissionCheck;
  quiz?: MissionQuiz;
};

export type MissionSource = { title: string; publisher: string; url: string; date: string; note?: string };

export type MissionMaterial =
  | { type: "sample"; sample_key: string; label: string }
  | { type: "link"; href: string; label: string; external?: boolean }
  | { type: "text"; title: string; body: string };

export type MissionDossier = {
  phenomenon: string;
  figures: { text: string; source: number }[];
  how_it_works: { step: string; technique: string | null }[];
  red_flags: string[];
  impact: string;
  defenses: string[];
};

export type MissionContent = {
  request: { from: string; channel: string; text: string };
  context: string;
  dossier?: MissionDossier;
  materials: MissionMaterial[];
  steps: MissionStep[];
  sources: MissionSource[];
};

export type Mission = {
  id: string;
  slug: string;
  kind: "guided" | "real_case";
  sort_order: number;
  title: string;
  summary: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: string;
  roles: string[];
  estimated_minutes: number;
  content: MissionContent;
};

export type StepState = { done: boolean; answer: unknown; correct: boolean | null; attempts: number; completed_at: string };

export type MissionRun = {
  id: string;
  mission_id: string;
  case_id: string | null;
  status: "in_progress" | "completed";
  steps: Record<string, StepState>;
  started_at: string;
  completed_at: string | null;
};

export type StepNote = { explanation?: string; senior?: string; correct_answer?: unknown };

export type CheckResult =
  | { passed: false; message: string }
  | { passed: true; correct: boolean | null; correct_answer?: unknown; explanation?: string; senior?: string };

export type Debrief = { summary: string; lessons: string[]; next: string[] };

export const CHECK_LABELS: Record<string, string> = {
  objective: "Obiettivo investigativo scritto nel caso",
  case: "Caso della tipologia giusta collegato",
  tasks: "Attività create nel caso",
  evidence: "Evidenza registrata",
  phishing: "Analisi phishing salvata sul caso",
  domain: "Analisi di dominio salvata sul caso",
  ioc: "IOC registrati",
  finding: "Risultati OSINT registrati",
  sources: "Fonti diverse registrate",
  timeline: "Eventi in timeline",
  attack: "Tecniche ATT&CK mappate",
  report: "Report creato",
  risk_set: "Rischio del caso aggiornato",
  closed: "Caso chiuso",
};

export function resolveHref(href: string, caseId: string | null): string | null {
  if (href.includes("{case}")) return caseId ? href.replaceAll("{case}", caseId) : null;
  return href;
}

export function missionScore(mission: Mission, run: MissionRun): { graded: number; correct: number } {
  let graded = 0;
  let correct = 0;
  for (const s of mission.content.steps) {
    if (s.quiz && s.quiz.type !== "text" && run.steps[s.id]?.done) {
      graded += 1;
      if (run.steps[s.id]?.correct) correct += 1;
    }
  }
  return { graded, correct };
}
