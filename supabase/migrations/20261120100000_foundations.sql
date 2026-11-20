-- =============================================================================
-- Sentinel Intelligence — 001 Foundations
-- Enumerated types and generic helpers shared by every other migration.
-- =============================================================================

-- Application roles inside an organization.
--   admin    = Administrator (manages members, deletes, demo data)
--   analyst  = Analyst (full read/write on the organization's investigations)
--   trainee  = Trainee (read access, writes only on what they created)
create type public.org_role as enum ('admin', 'analyst', 'trainee');

-- Platform-wide role stored on the profile (never writable by the user).
create type public.app_role as enum ('administrator', 'analyst', 'trainee');

create type public.case_category as enum (
  'osint_investigation',
  'cyber_threat_intelligence',
  'phishing_investigation',
  'domain_investigation',
  'digital_risk_assessment',
  'corporate_due_diligence',
  'brand_impersonation',
  'security_incident_analysis',
  'investigation_training'
);

create type public.case_status as enum ('open', 'in_progress', 'on_hold', 'closed', 'archived');
create type public.priority_level as enum ('low', 'medium', 'high', 'critical');
create type public.risk_level as enum ('informational', 'low', 'medium', 'high', 'critical');
create type public.task_status as enum ('todo', 'in_progress', 'done', 'cancelled');

-- Information status: the platform must never confuse hypotheses with facts.
create type public.info_status as enum (
  'verified_fact',      -- Fatto verificato
  'to_verify',          -- Informazione da verificare
  'hypothesis',         -- Ipotesi analitica
  'contradictory',      -- Informazione contraddittoria
  'unavailable'         -- Dato non disponibile
);

-- Analyst confidence (Words of Estimative Probability, simplified).
create type public.confidence_level as enum ('low', 'moderate', 'high');

create type public.evidence_type as enum (
  'document', 'screenshot', 'text', 'pdf', 'email', 'web_capture', 'dataset', 'other'
);

create type public.ioc_type as enum ('ipv4', 'ipv6', 'domain', 'url', 'sha256', 'sha1', 'md5');
create type public.analyst_verdict as enum ('undetermined', 'benign', 'suspicious', 'malicious');

create type public.report_type as enum (
  'osint_investigation',
  'cyber_threat_intelligence',
  'phishing_investigation',
  'domain_investigation',
  'digital_risk_assessment',
  'corporate_due_diligence',
  'executive_brief'
);
create type public.report_status as enum ('draft', 'final');
create type public.classification_level as enum ('public', 'internal', 'confidential', 'restricted');

create type public.attempt_status as enum ('in_progress', 'submitted');

-- -----------------------------------------------------------------------------
-- Source reliability uses the Admiralty (NATO) scale A–F:
--   A completely reliable · B usually reliable · C fairly reliable
--   D not usually reliable · E unreliable · F reliability cannot be judged
-- Stored as a domain so every table shares the same constraint.
-- -----------------------------------------------------------------------------
create domain public.source_reliability as text
  check (value in ('A', 'B', 'C', 'D', 'E', 'F'));

-- Generic updated_at trigger.
create function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- A short, human friendly reference generator (e.g. SI-2026-0007).
create sequence public.case_ref_seq;
