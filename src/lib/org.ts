import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { requireUser, type SessionUser } from "@/lib/auth/session";
import type { OrgRole } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_ORG_COOKIE = "si_org";

export type Membership = { organizationId: string; name: string; role: OrgRole };

export type OrgContext = {
  user: SessionUser;
  fullName: string | null;
  platformRole: "administrator" | "analyst" | "trainee";
  memberships: Membership[];
  active: Membership | null;
};

/**
 * Identity + organization context for the current request (memoised).
 * The active organization is a UI preference only: every query is still
 * filtered by RLS, so a forged cookie cannot widen access.
 */
export const getOrgContext = cache(async (): Promise<OrgContext> => {
  const user = await requireUser();
  const supabase = await createClient();

  const [profileRes, membershipRes] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", user.id)
      .order("created_at"),
  ]);

  const memberships: Membership[] = (membershipRes.data ?? []).map((m) => {
    const org = m.organizations as unknown as { name: string } | null;
    return { organizationId: m.organization_id as string, name: org?.name ?? "—", role: m.role as OrgRole };
  });

  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const active = memberships.find((m) => m.organizationId === preferred) ?? memberships[0] ?? null;

  return {
    user,
    fullName: (profileRes.data?.full_name as string | null) ?? user.fullName,
    platformRole: (profileRes.data?.role as OrgContext["platformRole"]) ?? "analyst",
    memberships,
    active,
  };
});

/** For pages and actions that need an organization to work on. */
export async function requireActiveOrg(): Promise<OrgContext & { active: Membership }> {
  const ctx = await getOrgContext();
  if (!ctx.active) {
    throw new Error("Nessuna organizzazione associata all'utente.");
  }
  return ctx as OrgContext & { active: Membership };
}

export function canWrite(role: OrgRole | undefined | null): boolean {
  return role === "admin" || role === "analyst";
}
