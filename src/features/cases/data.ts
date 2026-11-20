import "server-only";

import type {
  CaseCategory,
  CaseStatus,
  Confidence,
  EventCategory,
  EvidenceType,
  InfoStatus,
  Priority,
  Reliability,
  RiskLevel,
  TaskStatus,
} from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

export type CaseRow = {
  id: string;
  organization_id: string;
  case_ref: string;
  title: string;
  description: string | null;
  objective: string | null;
  category: CaseCategory;
  status: CaseStatus;
  priority: Priority;
  risk_level: RiskLevel;
  notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  is_demo: boolean;
  opened_at: string;
  closed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  case_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_at: string | null;
  created_at: string;
};

export type EventRow = {
  id: string;
  case_id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  source: string | null;
  reliability: Reliability;
  info_status: InfoStatus;
  event_at: string;
  recorded_at: string;
  evidence_id: string | null;
};

export type EvidenceRow = {
  id: string;
  case_id: string;
  title: string;
  description: string | null;
  evidence_type: EvidenceType;
  source: string | null;
  source_url: string | null;
  acquisition_method: string | null;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  sha256_hash: string | null;
  reliability: Reliability;
  verification_status: InfoStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  is_demo: boolean;
  collected_by: string | null;
  collected_at: string;
  last_integrity_check_at: string | null;
  last_integrity_ok: boolean | null;
  created_at: string;
};

export type Member = { user_id: string; full_name: string | null; role: string };

export async function getMembers(orgId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data: members } = await supabase.from("organization_members").select("user_id, role").eq("organization_id", orgId);
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (!ids.length) return [];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  return (members ?? []).map((m) => ({
    user_id: m.user_id as string,
    role: m.role as string,
    full_name: (profiles?.find((p) => p.id === m.user_id)?.full_name as string | null) ?? null,
  }));
}

/** Cases the user can see in the active organization (for selects). */
export async function getCaseOptions(orgId: string, { includeArchived = false } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("cases")
    .select("id, case_ref, title, status")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (!includeArchived) query = query.neq("status", "archived");
  const { data } = await query;
  return (data ?? []).map((c) => [c.id as string, `${c.case_ref} · ${c.title}`] as const);
}

export type FindingRow = {
  id: string;
  case_id: string | null;
  source_id: string | null;
  title: string;
  subject: string | null;
  source_name: string;
  source_url: string | null;
  collected_at: string;
  acquisition_method: string;
  data: string;
  reliability: Reliability;
  info_status: InfoStatus;
  verification_notes: string | null;
  limitations: string | null;
  is_demo: boolean;
  created_at: string;
};

export type IocRow = {
  id: string;
  case_id: string | null;
  indicator_type: string;
  indicator_value: string;
  source: string | null;
  confidence: Confidence;
  analyst_verdict: "undetermined" | "benign" | "suspicious" | "malicious";
  analyst_notes: string | null;
  tlp: string;
  is_demo: boolean;
  created_at: string;
};
