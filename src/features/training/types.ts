export type Question =
  | { id: string; type: "single"; prompt: string; options: { value: string; label: string }[] }
  | { id: string; type: "multi"; prompt: string; options: { value: string; label: string }[] }
  | { id: string; type: "keywords"; prompt: string; placeholder?: string };

export type ScenarioContent = {
  scenario: string;
  briefing: { from: string; text: string };
  objective: string;
  documents: { id: string; title: string; kind: string; source: string; body: string }[];
  tasks: string[];
  tools: string[];
  instructions: string[];
  deliverable: { title: string; sections: string[] };
  questions: Question[];
  sample_key?: string;
};

export type RubricItem = { id: string; criterion: string; description: string; weight: number };

export type Scenario = {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: string;
  estimated_minutes: number;
  skills: string[];
  content: ScenarioContent;
  grading_rubric: RubricItem[];
};

export type Attempt = {
  id: string;
  scenario_id: string;
  status: "in_progress" | "submitted";
  answers: Record<string, string | string[]>;
  submitted_content: string | null;
  self_assessment: Record<string, number>;
  score: number | null;
  max_score: number | null;
  feedback: Record<string, { earned: number; points: number; correct: boolean; explanation: string | null }> | null;
  started_at: string;
  completed_at: string | null;
};

export type Solution = {
  summary: string;
  key_findings?: string[];
  timeline?: string[];
  indicators?: string[];
  recommendations?: string[];
  common_mistakes?: string[];
};

export const DIFFICULTY = { beginner: "Base", intermediate: "Intermedio", advanced: "Avanzato" } as const;

/** Self-assessment scale for the rubric (formative, not a certification). */
export const RUBRIC_SCALE = [
  [0, "0 — Non affrontato"],
  [1, "1 — Insufficiente"],
  [2, "2 — Parziale"],
  [3, "3 — Adeguato"],
  [4, "4 — Completo e motivato"],
] as const;

export function rubricPercent(rubric: RubricItem[], selfAssessment: Record<string, number>): number | null {
  const total = rubric.reduce((acc, r) => acc + r.weight, 0);
  if (!total || !rubric.some((r) => selfAssessment[r.id] !== undefined)) return null;
  const got = rubric.reduce((acc, r) => acc + (r.weight * (selfAssessment[r.id] ?? 0)) / 4, 0);
  return Math.round((got / total) * 100);
}

/** Builds the answers object from a form, using the scenario's question list. */
export function answersFromForm(questions: Question[], get: (k: string) => string | null, getAll: (k: string) => string[]) {
  const answers: Record<string, string | string[]> = {};
  for (const q of questions) {
    const key = `q_${q.id}`;
    if (q.type === "multi") {
      const allowed = new Set(q.options.map((o) => o.value));
      answers[q.id] = getAll(key).filter((v) => allowed.has(v));
    } else if (q.type === "single") {
      const v = get(key);
      if (v && q.options.some((o) => o.value === v)) answers[q.id] = v;
    } else {
      const v = (get(key) ?? "").slice(0, 5000);
      if (v.trim()) answers[q.id] = v;
    }
  }
  return answers;
}
