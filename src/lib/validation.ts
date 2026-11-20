/**
 * Zod schemas for every write operation. They mirror the database CHECK
 * constraints so users get friendly messages; the database remains the
 * final authority.
 */
import { z } from "zod";

import {
  CASE_CATEGORY_VALUES,
  CASE_STATUS_VALUES,
  CLASSIFICATION_VALUES,
  CONFIDENCE_VALUES,
  EVENT_CATEGORY_VALUES,
  EVIDENCE_TYPE_VALUES,
  INFO_STATUS_VALUES,
  IOC_TYPE_VALUES,
  PRIORITY_VALUES,
  RELIABILITY_VALUES,
  REPORT_TYPE_VALUES,
  RISK_LEVEL_VALUES,
  SOURCE_TYPE_VALUES,
  TASK_STATUS_VALUES,
  TLP_VALUES,
  VERDICT_VALUES,
} from "@/lib/domain";
import { parseLocalDateTime } from "@/lib/format";
import { isHttpUrl, normalizeIndicator, validateIndicator } from "@/lib/indicators";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max, `Massimo ${max} caratteri`).optional());

const requiredText = (min: number, max: number, field: string) =>
  z
    .string({ message: `${field} obbligatorio` })
    .trim()
    .min(min, `${field}: almeno ${min} caratteri`)
    .max(max, `${field}: massimo ${max} caratteri`);

const optionalUuid = z.preprocess(blankToUndefined, z.uuid("Identificativo non valido").optional());

const optionalHttpUrl = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .max(2048)
    .refine(isHttpUrl, "Inserisci un URL http(s) valido")
    .optional(),
);

/** datetime-local input ("2026-11-20T10:30") → ISO string. */
const dateTime = (field: string) =>
  z
    .string({ message: `${field} obbligatoria` })
    .trim()
    .min(1, `${field} obbligatoria`)
    .refine((v) => !Number.isNaN(parseLocalDateTime(v).getTime()), `${field} non valida`)
    .transform((v) => parseLocalDateTime(v).toISOString());

const optionalDateTime = z.preprocess(
  blankToUndefined,
  z
    .string()
    .refine((v) => !Number.isNaN(parseLocalDateTime(v).getTime()), "Data non valida")
    .transform((v) => parseLocalDateTime(v).toISOString())
    .optional(),
);

export const caseSchema = z.object({
  title: requiredText(3, 200, "Titolo"),
  description: optionalText(10000),
  objective: optionalText(4000),
  category: z.enum(CASE_CATEGORY_VALUES, { message: "Tipologia non valida" }),
  status: z.enum(CASE_STATUS_VALUES).default("open"),
  priority: z.enum(PRIORITY_VALUES).default("medium"),
  risk_level: z.enum(RISK_LEVEL_VALUES).default("informational"),
  notes: optionalText(20000),
  assigned_to: optionalUuid,
});

export const taskSchema = z.object({
  title: requiredText(2, 200, "Titolo"),
  description: optionalText(4000),
  status: z.enum(TASK_STATUS_VALUES).default("todo"),
  due_at: optionalDateTime,
});

export const evidenceSchema = z.object({
  case_id: z.uuid("Seleziona un caso"),
  title: requiredText(2, 200, "Titolo"),
  description: optionalText(10000),
  evidence_type: z.enum(EVIDENCE_TYPE_VALUES).default("other"),
  source: optionalText(300),
  source_url: optionalHttpUrl,
  acquisition_method: optionalText(300),
  reliability: z.enum(RELIABILITY_VALUES).default("F"),
  verification_status: z.enum(INFO_STATUS_VALUES).default("to_verify"),
  notes: optionalText(10000),
  collected_at: optionalDateTime,
});

export const evidenceUpdateSchema = evidenceSchema.pick({
  title: true,
  description: true,
  reliability: true,
  verification_status: true,
  notes: true,
});

export const findingSchema = z.object({
  case_id: optionalUuid,
  source_id: optionalUuid,
  title: requiredText(2, 200, "Titolo"),
  subject: optionalText(300),
  source_name: requiredText(1, 300, "Fonte"),
  source_url: optionalHttpUrl,
  collected_at: dateTime("Data di raccolta"),
  acquisition_method: requiredText(2, 300, "Metodo di acquisizione"),
  data: requiredText(1, 20000, "Dati ottenuti"),
  reliability: z.enum(RELIABILITY_VALUES),
  info_status: z.enum(INFO_STATUS_VALUES),
  verification_notes: optionalText(4000),
  limitations: optionalText(4000),
});

export const sourceSchema = z.object({
  name: requiredText(2, 200, "Nome"),
  source_type: z.enum(SOURCE_TYPE_VALUES),
  url: optionalHttpUrl,
  description: optionalText(4000),
  default_reliability: z.enum(RELIABILITY_VALUES).default("F"),
});

export const iocSchema = z
  .object({
    indicator_type: z.enum(IOC_TYPE_VALUES, { message: "Tipo di indicatore non valido" }),
    indicator_value: requiredText(1, 2048, "Valore"),
    case_id: optionalUuid,
    source: optionalText(300),
    confidence: z.enum(CONFIDENCE_VALUES).default("low"),
    analyst_verdict: z.enum(VERDICT_VALUES).default("undetermined"),
    analyst_notes: optionalText(10000),
    tlp: z.enum(TLP_VALUES).default("amber"),
  })
  .superRefine((v, ctx) => {
    if (!validateIndicator(v.indicator_type, v.indicator_value)) {
      ctx.addIssue({ code: "custom", path: ["indicator_value"], message: "Formato non valido per il tipo selezionato" });
    }
  })
  .transform((v) => ({ ...v, indicator_value: normalizeIndicator(v.indicator_type, v.indicator_value) }));

export const iocUpdateSchema = z.object({
  confidence: z.enum(CONFIDENCE_VALUES),
  analyst_verdict: z.enum(VERDICT_VALUES),
  analyst_notes: optionalText(10000),
  tlp: z.enum(TLP_VALUES),
  case_id: optionalUuid,
});

export const eventSchema = z.object({
    title: requiredText(2, 200, "Titolo"),
    description: optionalText(4000),
    category: z.enum(EVENT_CATEGORY_VALUES).default("other"),
    source: optionalText(300),
    reliability: z.enum(RELIABILITY_VALUES).default("F"),
    info_status: z.enum(INFO_STATUS_VALUES).default("to_verify"),
    event_at: dateTime("Data dell'evento"),
    recorded_at: optionalDateTime,
    evidence_id: optionalUuid,
  });

export const reportCreateSchema = z.object({
  case_id: z.uuid("Seleziona un caso"),
  report_type: z.enum(REPORT_TYPE_VALUES),
  title: requiredText(3, 200, "Titolo"),
  classification: z.enum(CLASSIFICATION_VALUES).default("internal"),
});

export const REPORT_SECTIONS = [
  { key: "executive_summary", label: "Executive Summary" },
  { key: "objective", label: "Obiettivo investigativo" },
  { key: "methodology", label: "Metodologia" },
  { key: "analysis", label: "Analisi" },
  { key: "risk_assessment", label: "Valutazione del rischio" },
  { key: "conclusions", label: "Conclusioni" },
  { key: "recommendations", label: "Raccomandazioni" },
  { key: "limitations", label: "Limitazioni" },
  { key: "attachments", label: "Allegati (note)" },
] as const;
export type ReportSectionKey = (typeof REPORT_SECTIONS)[number]["key"];

export const reportContentSchema = z.object({
  title: requiredText(3, 200, "Titolo"),
  classification: z.enum(CLASSIFICATION_VALUES),
  confidence: z.preprocess(blankToUndefined, z.enum(CONFIDENCE_VALUES).optional()),
  ...Object.fromEntries(REPORT_SECTIONS.map((s) => [s.key, optionalText(20000)])),
}) as z.ZodType<
  { title: string; classification: (typeof CLASSIFICATION_VALUES)[number]; confidence?: (typeof CONFIDENCE_VALUES)[number] } & Partial<
    Record<ReportSectionKey, string>
  >
>;

export const domainInputSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, ""))
  .pipe(
    z
      .string()
      .min(3, "Dominio troppo corto")
      .max(253, "Dominio troppo lungo")
      .regex(/^(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/, "Formato del dominio non valido"),
  );

export const profileSchema = z.object({ full_name: requiredText(2, 120, "Nome") });
