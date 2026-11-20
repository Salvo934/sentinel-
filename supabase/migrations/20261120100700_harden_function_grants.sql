-- =============================================================================
-- Sentinel Intelligence — 008 Function privilege hardening
-- Supabase grants EXECUTE on new public functions to anon/authenticated by
-- default. Found by the Supabase security advisor:
--   * trigger functions must never be callable as RPC;
--   * RLS helper functions are not needed by anonymous callers;
--   * case_org() is only used inside SECURITY DEFINER code.
-- RLS helpers stay executable by `authenticated` because policies are
-- evaluated with the caller's privileges. They only reveal facts about the
-- caller's own memberships.
-- =============================================================================

revoke execute on function
  public.tg_cases_lifecycle(),
  public.tg_check_case_org(),
  public.tg_event_evidence_same_case(),
  public.tg_relationship_same_case(),
  public.tg_force_author(),
  public.tg_evidence_immutable_fields(),
  public.tg_reports_lock_final(),
  public.tg_profiles_protect_role(),
  public.tg_audit_immutable(),
  public.tg_set_updated_at()
from public, anon, authenticated;

revoke execute on function
  public.is_org_member(uuid),
  public.has_org_role(uuid, public.org_role[]),
  public.is_platform_admin(),
  public.shares_org_with(uuid),
  public.can_read_case(uuid),
  public.can_write_case(uuid),
  public.case_role_in(uuid, public.org_role[])
from public, anon;

revoke execute on function public.case_org(uuid) from public, anon, authenticated;

-- training_answer_keys intentionally has RLS enabled and no policies: it is
-- reachable only through SECURITY DEFINER functions (deny-all for the API).
comment on table public.training_answer_keys is
  'Answer keys and guided solutions. No API access by design (RLS on, no policies); read via submit_training_attempt / get_training_solution.';
