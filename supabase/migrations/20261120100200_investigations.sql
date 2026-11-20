-- =============================================================================
-- Sentinel Intelligence — 003 Investigations
-- Cases, tasks, evidence, OSINT findings/sources, entities & relationships,
-- IOC registry, timeline events, risk assessments, phishing and domain
-- analyses, reports. Every table is reachable only through an organization
-- the user belongs to — directly (organization_id) or through its case.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Generic trigger helpers
-- -----------------------------------------------------------------------------

-- Forces the "author" column (name passed as trigger argument) to the caller.
create function public.tg_force_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0], (select auth.uid())));
  end if;
  return new;
end;
$$;

-- For tables carrying both organization_id and an optional case_id: the case
-- must belong to the same organization.
create function public.tg_check_case_org()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.case_id is not null and not exists (
    select 1 from public.cases c where c.id = new.case_id and c.organization_id = new.organization_id
  ) then
    raise exception 'case % does not belong to organization %', new.case_id, new.organization_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cases
-- -----------------------------------------------------------------------------
create table public.cases (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  case_ref        text not null unique
                  default ('SI-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.case_ref_seq')::text, 4, '0')),
  title           text not null check (char_length(btrim(title)) between 3 and 200),
  description     text check (char_length(description) <= 10000),
  objective       text check (char_length(objective) <= 4000),
  category        public.case_category not null,
  status          public.case_status not null default 'open',
  priority        public.priority_level not null default 'medium',
  risk_level      public.risk_level not null default 'informational',
  notes           text check (char_length(notes) <= 20000),
  assigned_to     uuid references auth.users (id) on delete set null,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  is_demo         boolean not null default false,
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint cases_closed_after_open check (closed_at is null or closed_at >= opened_at)
);
create index cases_org_status_idx on public.cases (organization_id, status);
create index cases_org_category_idx on public.cases (organization_id, category);
create index cases_assigned_idx on public.cases (assigned_to);
create index cases_updated_idx on public.cases (organization_id, updated_at desc);

create function public.tg_cases_lifecycle()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null and not exists (
    select 1 from public.organization_members m
    where m.organization_id = new.organization_id and m.user_id = new.assigned_to
  ) then
    raise exception 'assignee must be a member of the organization' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id then
      raise exception 'a case cannot be moved to another organization' using errcode = '42501';
    end if;
    new.case_ref := old.case_ref;
    new.created_by := old.created_by;
    new.is_demo := old.is_demo;
  end if;

  if new.status = 'closed' and (tg_op = 'INSERT' or old.status <> 'closed') then
    new.closed_at := coalesce(new.closed_at, now());
  elsif new.status in ('open', 'in_progress', 'on_hold') then
    new.closed_at := null;
  end if;

  if new.status = 'archived' and (tg_op = 'INSERT' or old.status <> 'archived') then
    new.archived_at := now();
  elsif new.status <> 'archived' then
    new.archived_at := null;
  end if;
  return new;
end;
$$;

create trigger cases_author before insert on public.cases
  for each row execute function public.tg_force_author('created_by');
create trigger cases_lifecycle before insert or update on public.cases
  for each row execute function public.tg_cases_lifecycle();
create trigger cases_updated_at before update on public.cases
  for each row execute function public.tg_set_updated_at();

-- Case-level authorization helpers ------------------------------------------
create function public.can_read_case(p_case uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cases c
    join public.organization_members m
      on m.organization_id = c.organization_id and m.user_id = (select auth.uid())
    where c.id = p_case
  );
$$;

-- Write access to a case's content: admins/analysts of the organization, or a
-- trainee on a case they created. Archived cases are read-only.
create function public.can_write_case(p_case uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cases c
    join public.organization_members m
      on m.organization_id = c.organization_id and m.user_id = (select auth.uid())
    where c.id = p_case
      and c.status <> 'archived'
      and (m.role in ('admin', 'analyst') or (m.role = 'trainee' and c.created_by = (select auth.uid())))
  );
$$;

create function public.case_role_in(p_case uuid, p_roles public.org_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cases c
    join public.organization_members m
      on m.organization_id = c.organization_id and m.user_id = (select auth.uid())
    where c.id = p_case and m.role = any (p_roles)
  );
$$;

-- -----------------------------------------------------------------------------
-- Case tasks
-- -----------------------------------------------------------------------------
create table public.case_tasks (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 2 and 200),
  description text check (char_length(description) <= 4000),
  status      public.task_status not null default 'todo',
  assigned_to uuid references auth.users (id) on delete set null,
  due_at      timestamptz,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index case_tasks_case_idx on public.case_tasks (case_id, status);
create trigger case_tasks_author before insert on public.case_tasks
  for each row execute function public.tg_force_author('created_by');
create trigger case_tasks_updated_at before update on public.case_tasks
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Evidence
-- -----------------------------------------------------------------------------
create table public.evidence (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references public.cases (id) on delete cascade,
  title               text not null check (char_length(btrim(title)) between 2 and 200),
  description         text check (char_length(description) <= 10000),
  evidence_type       public.evidence_type not null default 'other',
  source              text check (char_length(source) <= 300),
  source_url          text check (char_length(source_url) <= 2048),
  acquisition_method  text check (char_length(acquisition_method) <= 300),
  storage_path        text unique check (char_length(storage_path) <= 1024),
  original_filename   text check (char_length(original_filename) <= 255),
  mime_type           text check (char_length(mime_type) <= 120),
  size_bytes          bigint check (size_bytes >= 0),
  sha256_hash         text check (sha256_hash ~ '^[0-9a-f]{64}$'),
  reliability         public.source_reliability not null default 'F',
  verification_status public.info_status not null default 'to_verify',
  notes               text check (char_length(notes) <= 10000),
  metadata            jsonb not null default '{}'::jsonb,
  is_demo             boolean not null default false,
  collected_by        uuid default auth.uid() references auth.users (id) on delete set null,
  collected_at        timestamptz not null default now(),
  last_integrity_check_at timestamptz,
  last_integrity_ok   boolean,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint evidence_file_has_hash check (storage_path is null or sha256_hash is not null)
);
create index evidence_case_idx on public.evidence (case_id, collected_at desc);
create index evidence_hash_idx on public.evidence (sha256_hash);

-- File reference and hash are write-once: integrity data cannot be rewritten.
create function public.tg_evidence_immutable_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.storage_path is not null and new.storage_path is distinct from old.storage_path then
    raise exception 'evidence storage_path is write-once' using errcode = '42501';
  end if;
  if old.sha256_hash is not null and new.sha256_hash is distinct from old.sha256_hash then
    raise exception 'evidence sha256_hash is write-once' using errcode = '42501';
  end if;
  if new.case_id <> old.case_id then
    raise exception 'evidence cannot be moved to another case' using errcode = '42501';
  end if;
  new.collected_by := old.collected_by;
  new.is_demo := old.is_demo;
  return new;
end;
$$;
create trigger evidence_author before insert on public.evidence
  for each row execute function public.tg_force_author('collected_by');
create trigger evidence_immutable before update on public.evidence
  for each row execute function public.tg_evidence_immutable_fields();
create trigger evidence_updated_at before update on public.evidence
  for each row execute function public.tg_set_updated_at();

-- Integrity check results are recorded through this RPC only (the server
-- recomputes the hash of the stored file and reports the outcome).
create function public.record_integrity_check(p_evidence uuid, p_ok boolean, p_computed text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_case uuid;
begin
  select case_id into v_case from public.evidence where id = p_evidence;
  if v_case is null or not public.can_read_case(v_case) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.evidence
     set last_integrity_check_at = now(), last_integrity_ok = p_ok
   where id = p_evidence;
  perform public.write_audit(public.case_org(v_case), v_case, 'evidence.integrity_checked', 'evidence', p_evidence,
    jsonb_build_object('ok', p_ok, 'computed_sha256', left(p_computed, 64)));
end;
$$;

create function public.case_org(p_case uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select organization_id from public.cases where id = p_case;
$$;

-- -----------------------------------------------------------------------------
-- OSINT sources and findings
-- -----------------------------------------------------------------------------
create table public.osint_sources (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 2 and 200),
  source_type     text not null check (source_type in (
                    'public_registry', 'dns', 'rdap_whois', 'certificate_transparency', 'news_media',
                    'corporate_website', 'social_media', 'threat_intel_feed', 'government', 'document', 'other')),
  url             text check (char_length(url) <= 2048),
  description     text check (char_length(description) <= 4000),
  default_reliability public.source_reliability not null default 'F',
  is_demo         boolean not null default false,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.osint_findings (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  case_id             uuid references public.cases (id) on delete set null,
  source_id           uuid references public.osint_sources (id) on delete set null,
  title               text not null check (char_length(btrim(title)) between 2 and 200),
  subject             text check (char_length(subject) <= 300),
  source_name         text not null check (char_length(btrim(source_name)) between 1 and 300),
  source_url          text check (char_length(source_url) <= 2048),
  collected_at        timestamptz not null default now(),
  acquisition_method  text not null check (char_length(btrim(acquisition_method)) between 2 and 300),
  data                text not null check (char_length(data) <= 20000),
  reliability         public.source_reliability not null default 'F',
  info_status         public.info_status not null default 'to_verify',
  verification_notes  text check (char_length(verification_notes) <= 4000),
  limitations         text check (char_length(limitations) <= 4000),
  is_demo             boolean not null default false,
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index osint_findings_org_idx on public.osint_findings (organization_id, collected_at desc);
create index osint_findings_case_idx on public.osint_findings (case_id);

create trigger osint_sources_author before insert on public.osint_sources
  for each row execute function public.tg_force_author('created_by');
create trigger osint_findings_author before insert on public.osint_findings
  for each row execute function public.tg_force_author('created_by');
create trigger osint_findings_case_org before insert or update on public.osint_findings
  for each row execute function public.tg_check_case_org();
create trigger osint_findings_updated_at before update on public.osint_findings
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Entities and relationships (foundation for the Investigation Graph)
-- -----------------------------------------------------------------------------
create table public.investigation_entities (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases (id) on delete cascade,
  entity_type  text not null check (entity_type in
                 ('organization', 'domain', 'ip', 'url', 'ioc', 'event', 'case', 'evidence', 'email', 'other')),
  entity_value text not null check (char_length(btrim(entity_value)) between 1 and 500),
  description  text check (char_length(description) <= 4000),
  position_x   double precision,
  position_y   double precision,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (case_id, entity_type, entity_value)
);

create table public.entity_relationships (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references public.cases (id) on delete cascade,
  source_entity_id  uuid not null references public.investigation_entities (id) on delete cascade,
  target_entity_id  uuid not null references public.investigation_entities (id) on delete cascade,
  relationship_type text not null check (char_length(btrim(relationship_type)) between 2 and 80),
  description       text check (char_length(description) <= 2000),
  source            text check (char_length(source) <= 300),
  confidence        public.confidence_level not null default 'low',
  info_status       public.info_status not null default 'hypothesis',
  evidence_id       uuid references public.evidence (id) on delete set null,
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint relationships_not_self check (source_entity_id <> target_entity_id)
);
create index entity_relationships_case_idx on public.entity_relationships (case_id);

create function public.tg_relationship_same_case()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.investigation_entities
      where id in (new.source_entity_id, new.target_entity_id) and case_id = new.case_id) <> 2 then
    raise exception 'both entities must belong to the relationship case' using errcode = '23514';
  end if;
  if new.evidence_id is not null and not exists (
    select 1 from public.evidence where id = new.evidence_id and case_id = new.case_id) then
    raise exception 'evidence must belong to the relationship case' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger entity_relationships_same_case before insert or update on public.entity_relationships
  for each row execute function public.tg_relationship_same_case();

-- -----------------------------------------------------------------------------
-- IOC registry
-- -----------------------------------------------------------------------------
create table public.ioc_indicators (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id         uuid references public.cases (id) on delete set null,
  indicator_type  public.ioc_type not null,
  indicator_value text not null check (char_length(btrim(indicator_value)) between 1 and 2048),
  source          text check (char_length(source) <= 300),
  confidence      public.confidence_level not null default 'low',
  analyst_verdict public.analyst_verdict not null default 'undetermined',
  analyst_notes   text check (char_length(analyst_notes) <= 10000),
  tlp             text not null default 'amber' check (tlp in ('clear', 'green', 'amber', 'amber_strict', 'red')),
  is_demo         boolean not null default false,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, indicator_type, indicator_value)
);
create index ioc_indicators_case_idx on public.ioc_indicators (case_id);
create trigger ioc_author before insert on public.ioc_indicators
  for each row execute function public.tg_force_author('created_by');
create trigger ioc_case_org before insert or update on public.ioc_indicators
  for each row execute function public.tg_check_case_org();
create trigger ioc_updated_at before update on public.ioc_indicators
  for each row execute function public.tg_set_updated_at();

-- Raw results reported by external/simulated sources. Kept apart from the
-- analyst verdict on purpose: reputation reported by a source is not a conclusion.
create table public.ioc_analysis_results (
  id           uuid primary key default gen_random_uuid(),
  indicator_id uuid not null references public.ioc_indicators (id) on delete cascade,
  provider     text not null check (char_length(provider) <= 80),
  data_mode    text not null default 'live' check (data_mode in ('live', 'simulated')),
  result       jsonb not null default '{}'::jsonb,
  checked_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index ioc_analysis_results_indicator_idx on public.ioc_analysis_results (indicator_id, checked_at desc);

-- -----------------------------------------------------------------------------
-- Timeline events
-- -----------------------------------------------------------------------------
create table public.investigation_events (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 2 and 200),
  description text check (char_length(description) <= 4000),
  category    text not null default 'other' check (category in
                ('infrastructure', 'communication', 'corporate', 'technical', 'incident', 'analysis', 'other')),
  source      text check (char_length(source) <= 300),
  reliability public.source_reliability not null default 'F',
  info_status public.info_status not null default 'to_verify',
  event_at    timestamptz not null,           -- when the event happened
  recorded_at timestamptz not null default now(), -- when the analyst learned about it
  evidence_id uuid references public.evidence (id) on delete set null,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index investigation_events_case_idx on public.investigation_events (case_id, event_at);

create function public.tg_event_evidence_same_case()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.evidence_id is not null and not exists (
    select 1 from public.evidence where id = new.evidence_id and case_id = new.case_id) then
    raise exception 'evidence must belong to the same case' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger investigation_events_evidence before insert or update on public.investigation_events
  for each row execute function public.tg_event_evidence_same_case();
create trigger investigation_events_author before insert on public.investigation_events
  for each row execute function public.tg_force_author('created_by');
create trigger investigation_events_updated_at before update on public.investigation_events
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Risk assessments (Phase 4 UI; table ready now)
-- -----------------------------------------------------------------------------
create table public.risk_assessments (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references public.cases (id) on delete cascade,
  title             text not null check (char_length(btrim(title)) between 2 and 200),
  description       text check (char_length(description) <= 4000),
  asset             text check (char_length(asset) <= 300),
  threat            text check (char_length(threat) <= 1000),
  vulnerability     text check (char_length(vulnerability) <= 1000),
  probability       smallint not null check (probability between 1 and 5),
  impact            smallint not null check (impact between 1 and 5),
  inherent_risk     smallint generated always as (probability * impact) stored,
  existing_controls text check (char_length(existing_controls) <= 2000),
  residual_probability smallint check (residual_probability between 1 and 5),
  residual_impact   smallint check (residual_impact between 1 and 5),
  residual_risk     smallint generated always as (residual_probability * residual_impact) stored,
  analyst_rating    public.risk_level,
  mitigation        text check (char_length(mitigation) <= 4000),
  owner             text check (char_length(owner) <= 120),
  due_at            date,
  status            text not null default 'identified' check (status in ('identified', 'assessed', 'treated', 'accepted', 'closed')),
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index risk_assessments_case_idx on public.risk_assessments (case_id);
create trigger risk_assessments_author before insert on public.risk_assessments
  for each row execute function public.tg_force_author('created_by');
create trigger risk_assessments_updated_at before update on public.risk_assessments
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Phishing analyses
-- -----------------------------------------------------------------------------
create table public.phishing_analyses (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  case_id             uuid references public.cases (id) on delete set null,
  title               text not null check (char_length(btrim(title)) between 2 and 200),
  input_mode          text not null check (input_mode in ('upload', 'paste', 'training_sample')),
  sample_key          text check (char_length(sample_key) <= 80),
  raw_message         text not null check (char_length(raw_message) <= 200000),
  parsed              jsonb not null default '{}'::jsonb,
  indicators          jsonb not null default '[]'::jsonb,
  verdict             public.analyst_verdict not null default 'undetermined',
  confidence          public.confidence_level not null default 'low',
  analyst_assessment  text check (char_length(analyst_assessment) <= 10000),
  is_demo             boolean not null default false,
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index phishing_analyses_org_idx on public.phishing_analyses (organization_id, created_at desc);
create trigger phishing_author before insert on public.phishing_analyses
  for each row execute function public.tg_force_author('created_by');
create trigger phishing_case_org before insert or update on public.phishing_analyses
  for each row execute function public.tg_check_case_org();
create trigger phishing_updated_at before update on public.phishing_analyses
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Domain analyses + query log (history, rate limiting, cost control)
-- -----------------------------------------------------------------------------
create table public.domain_analyses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id         uuid references public.cases (id) on delete set null,
  domain          text not null check (domain ~ '^[a-z0-9.-]{1,253}$'),
  data_mode       text not null check (data_mode in ('live', 'simulated')),
  dns             jsonb not null default '{}'::jsonb,
  rdap            jsonb,
  anomalies       jsonb not null default '[]'::jsonb,
  analyst_notes   text check (char_length(analyst_notes) <= 10000),
  risk_level      public.risk_level,
  risk_rationale  text check (char_length(risk_rationale) <= 4000),
  is_demo         boolean not null default false,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index domain_analyses_org_idx on public.domain_analyses (organization_id, created_at desc);
create trigger domain_analyses_author before insert on public.domain_analyses
  for each row execute function public.tg_force_author('created_by');
create trigger domain_analyses_case_org before insert or update on public.domain_analyses
  for each row execute function public.tg_check_case_org();

create table public.osint_queries (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  query_type      text not null check (query_type in ('dns', 'rdap', 'ioc_lookup')),
  query_value     text not null check (char_length(query_value) <= 2048),
  provider        text not null check (char_length(provider) <= 80),
  outcome         text not null check (outcome in ('ok', 'error', 'rate_limited', 'simulated', 'cached')),
  duration_ms     integer,
  created_at      timestamptz not null default now()
);
create index osint_queries_user_idx on public.osint_queries (user_id, created_at desc);
create trigger osint_queries_author before insert on public.osint_queries
  for each row execute function public.tg_force_author('user_id');

-- Rate limit helper: how many queries did the caller run in the last N seconds?
create function public.recent_query_count(p_seconds integer)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(*)::int from public.osint_queries
  where user_id = (select auth.uid()) and created_at > now() - make_interval(secs => p_seconds);
$$;

-- -----------------------------------------------------------------------------
-- Reports (versioned; final versions are immutable)
-- -----------------------------------------------------------------------------
create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.cases (id) on delete cascade,
  report_key      uuid not null default gen_random_uuid(),
  version         integer not null default 1 check (version >= 1),
  report_type     public.report_type not null,
  title           text not null check (char_length(btrim(title)) between 3 and 200),
  classification  public.classification_level not null default 'internal',
  status          public.report_status not null default 'draft',
  content         jsonb not null default '{}'::jsonb,
  storage_path    text check (char_length(storage_path) <= 1024),
  is_demo         boolean not null default false,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  finalized_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (report_key, version)
);
create index reports_case_idx on public.reports (case_id, created_at desc);

create function public.tg_reports_lock_final()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.case_id <> old.case_id or new.report_key <> old.report_key or new.version <> old.version then
    raise exception 'report identity is immutable' using errcode = '42501';
  end if;
  if old.status = 'final' then
    -- Only the exported PDF path may still be attached to a final version.
    if (to_jsonb(new) - 'storage_path' - 'updated_at') <> (to_jsonb(old) - 'storage_path' - 'updated_at') then
      raise exception 'final reports are immutable: create a new version' using errcode = '42501';
    end if;
  elsif new.status = 'final' then
    new.finalized_at := now();
  end if;
  new.created_by := old.created_by;
  return new;
end;
$$;
create trigger reports_author before insert on public.reports
  for each row execute function public.tg_force_author('created_by');
create trigger reports_lock_final before update on public.reports
  for each row execute function public.tg_reports_lock_final();
create trigger reports_updated_at before update on public.reports
  for each row execute function public.tg_set_updated_at();

-- New version of an existing report (copies content of the latest version).
create function public.create_report_version(p_report_key uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_last public.reports;
  v_id uuid;
begin
  select * into v_last from public.reports where report_key = p_report_key order by version desc limit 1;
  if v_last.id is null or not public.can_write_case(v_last.case_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  insert into public.reports (case_id, report_key, version, report_type, title, classification, status, content, is_demo, created_by)
  values (v_last.case_id, v_last.report_key, v_last.version + 1, v_last.report_type, v_last.title,
          v_last.classification, 'draft', v_last.content, v_last.is_demo, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Audit triggers
-- -----------------------------------------------------------------------------
create function public.tg_audit_row()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_org uuid := nullif(v_row ->> 'organization_id', '')::uuid;
  v_case uuid := case when tg_table_name = 'cases' then (v_row ->> 'id')::uuid
                      else nullif(v_row ->> 'case_id', '')::uuid end;
  v_changed text[];
  v_meta jsonb;
begin
  if v_org is null and v_case is not null then
    select organization_id into v_org from public.cases where id = v_case;
  end if;
  if v_org is null then
    return null; -- parent case already removed by a cascade: the parent's delete is logged
  end if;

  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into v_changed
    from jsonb_each(v_row) as n(key, value)
    where key not in ('updated_at') and n.value is distinct from (v_old -> key);
    if v_changed is null then
      return null;
    end if;
  end if;

  v_meta := jsonb_strip_nulls(jsonb_build_object(
    'title', coalesce(v_row ->> 'title', v_row ->> 'indicator_value', v_row ->> 'domain'),
    'changed', to_jsonb(v_changed),
    'status', case when tg_op = 'UPDATE' and 'status' = any (v_changed) then v_row ->> 'status' end,
    'previous_status', case when tg_op = 'UPDATE' and 'status' = any (v_changed) then v_old ->> 'status' end
  ));

  perform public.write_audit(
    v_org, v_case,
    tg_argv[0] || '.' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    tg_argv[0], (v_row ->> 'id')::uuid, v_meta);
  return null;
end;
$$;

create trigger audit_cases after insert or update or delete on public.cases
  for each row execute function public.tg_audit_row('case');
create trigger audit_case_tasks after insert or update or delete on public.case_tasks
  for each row execute function public.tg_audit_row('task');
create trigger audit_evidence after insert or update or delete on public.evidence
  for each row execute function public.tg_audit_row('evidence');
create trigger audit_osint_findings after insert or update or delete on public.osint_findings
  for each row execute function public.tg_audit_row('osint_finding');
create trigger audit_ioc after insert or update or delete on public.ioc_indicators
  for each row execute function public.tg_audit_row('ioc');
create trigger audit_events after insert or update or delete on public.investigation_events
  for each row execute function public.tg_audit_row('timeline_event');
create trigger audit_risk after insert or update or delete on public.risk_assessments
  for each row execute function public.tg_audit_row('risk');
create trigger audit_phishing after insert or update or delete on public.phishing_analyses
  for each row execute function public.tg_audit_row('phishing_analysis');
create trigger audit_domain after insert or delete on public.domain_analyses
  for each row execute function public.tg_audit_row('domain_analysis');
create trigger audit_reports after insert or update or delete on public.reports
  for each row execute function public.tg_audit_row('report');

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.cases enable row level security;
alter table public.case_tasks enable row level security;
alter table public.evidence enable row level security;
alter table public.osint_sources enable row level security;
alter table public.osint_findings enable row level security;
alter table public.investigation_entities enable row level security;
alter table public.entity_relationships enable row level security;
alter table public.ioc_indicators enable row level security;
alter table public.ioc_analysis_results enable row level security;
alter table public.investigation_events enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.phishing_analyses enable row level security;
alter table public.domain_analyses enable row level security;
alter table public.osint_queries enable row level security;
alter table public.reports enable row level security;

revoke all on public.cases, public.case_tasks, public.evidence, public.osint_sources, public.osint_findings,
  public.investigation_entities, public.entity_relationships, public.ioc_indicators, public.ioc_analysis_results,
  public.investigation_events, public.risk_assessments, public.phishing_analyses, public.domain_analyses,
  public.osint_queries, public.reports
  from anon, authenticated;

grant select, insert, update, delete on public.cases, public.case_tasks, public.evidence, public.osint_sources,
  public.osint_findings, public.investigation_entities, public.entity_relationships, public.ioc_indicators,
  public.investigation_events, public.risk_assessments, public.phishing_analyses, public.reports
  to authenticated;
grant select, insert, delete on public.domain_analyses to authenticated;
grant update (analyst_notes, risk_level, risk_rationale, case_id) on public.domain_analyses to authenticated;
grant select, insert on public.ioc_analysis_results, public.osint_queries to authenticated;

-- Cases ----------------------------------------------------------------------
create policy cases_select on public.cases for select to authenticated
  using (public.is_org_member(organization_id));
create policy cases_insert on public.cases for insert to authenticated
  with check (public.is_org_member(organization_id) and is_demo = false);
create policy cases_update on public.cases for update to authenticated
  using (
    public.has_org_role(organization_id, array['admin', 'analyst']::public.org_role[])
    or (public.has_org_role(organization_id, array['trainee']::public.org_role[]) and created_by = (select auth.uid()))
  )
  with check (public.is_org_member(organization_id));
-- Controlled deletion: admins only, and only once the case has been archived.
create policy cases_delete on public.cases for delete to authenticated
  using (status = 'archived' and public.has_org_role(organization_id, array['admin']::public.org_role[]));

-- Case children (tasks, events, entities, relationships, risks) --------------
create policy case_tasks_select on public.case_tasks for select to authenticated using (public.can_read_case(case_id));
create policy case_tasks_insert on public.case_tasks for insert to authenticated with check (public.can_write_case(case_id));
create policy case_tasks_update on public.case_tasks for update to authenticated
  using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy case_tasks_delete on public.case_tasks for delete to authenticated using (public.can_write_case(case_id));

create policy events_select on public.investigation_events for select to authenticated using (public.can_read_case(case_id));
create policy events_insert on public.investigation_events for insert to authenticated with check (public.can_write_case(case_id));
create policy events_update on public.investigation_events for update to authenticated
  using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy events_delete on public.investigation_events for delete to authenticated using (public.can_write_case(case_id));

create policy entities_select on public.investigation_entities for select to authenticated using (public.can_read_case(case_id));
create policy entities_insert on public.investigation_entities for insert to authenticated with check (public.can_write_case(case_id));
create policy entities_update on public.investigation_entities for update to authenticated
  using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy entities_delete on public.investigation_entities for delete to authenticated using (public.can_write_case(case_id));

create policy relationships_select on public.entity_relationships for select to authenticated using (public.can_read_case(case_id));
create policy relationships_insert on public.entity_relationships for insert to authenticated with check (public.can_write_case(case_id));
create policy relationships_update on public.entity_relationships for update to authenticated
  using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy relationships_delete on public.entity_relationships for delete to authenticated using (public.can_write_case(case_id));

create policy risks_select on public.risk_assessments for select to authenticated using (public.can_read_case(case_id));
create policy risks_insert on public.risk_assessments for insert to authenticated with check (public.can_write_case(case_id));
create policy risks_update on public.risk_assessments for update to authenticated
  using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy risks_delete on public.risk_assessments for delete to authenticated using (public.can_write_case(case_id));

-- Evidence: anyone who can write the case can add/annotate; deletion is
-- reserved to organization admins (evidence should be preserved).
create policy evidence_select on public.evidence for select to authenticated using (public.can_read_case(case_id));
create policy evidence_insert on public.evidence for insert to authenticated
  with check (public.can_write_case(case_id) and is_demo = false);
create policy evidence_update on public.evidence for update to authenticated
  using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy evidence_delete on public.evidence for delete to authenticated
  using (public.case_role_in(case_id, array['admin']::public.org_role[]));

-- Reports: drafts are editable by case writers; final versions are locked by
-- trigger; deleting a final version requires an admin.
create policy reports_select on public.reports for select to authenticated using (public.can_read_case(case_id));
create policy reports_insert on public.reports for insert to authenticated
  with check (public.can_write_case(case_id) and status = 'draft' and is_demo = false);
create policy reports_update on public.reports for update to authenticated
  using (public.can_write_case(case_id))
  with check (public.can_write_case(case_id));
create policy reports_delete on public.reports for delete to authenticated
  using ((status = 'draft' and public.can_write_case(case_id))
         or public.case_role_in(case_id, array['admin']::public.org_role[]));

-- Organization-scoped registries ---------------------------------------------
create policy sources_select on public.osint_sources for select to authenticated using (public.is_org_member(organization_id));
create policy sources_insert on public.osint_sources for insert to authenticated
  with check (public.is_org_member(organization_id) and is_demo = false);
create policy sources_update on public.osint_sources for update to authenticated
  using (public.has_org_role(organization_id, array['admin', 'analyst']::public.org_role[]) or created_by = (select auth.uid()))
  with check (public.is_org_member(organization_id));
create policy sources_delete on public.osint_sources for delete to authenticated
  using (public.has_org_role(organization_id, array['admin', 'analyst']::public.org_role[]) or created_by = (select auth.uid()));

-- Same pattern for findings, IOC, phishing and domain analyses.
create policy findings_select on public.osint_findings for select to authenticated using (public.is_org_member(organization_id));
create policy findings_insert on public.osint_findings for insert to authenticated
  with check (public.is_org_member(organization_id) and is_demo = false
              and (case_id is null or public.can_write_case(case_id)));
create policy findings_update on public.osint_findings for update to authenticated
  using (public.has_org_role(organization_id, array['admin', 'analyst']::public.org_role[]) or created_by = (select auth.uid()))
  with check (public.is_org_member(organization_id) and (case_id is null or public.can_write_case(case_id)));
create policy findings_delete on public.osint_findings for delete to authenticated
  using (public.has_org_role(organization_id, array['admin', 'analyst']::public.org_role[]) or created_by = (select auth.uid()));

create policy ioc_select on public.ioc_indicators for select to authenticated using (public.is_org_member(organization_id));
create policy ioc_insert on public.ioc_indicators for insert to authenticated
  with check (public.is_org_member(organization_id) and is_demo = false
              and (case_id is null or public.can_write_case(case_id)));
create policy ioc_update on public.ioc_indicators for update to authenticated
  using (public.has_org_role(organization_id, array['admin', 'analyst']::public.org_role[]) or created_by = (select auth.uid()))
  with check (public.is_org_member(organization_id) and (case_id is null or public.can_write_case(case_id)));
create policy ioc_delete on public.ioc_indicators for delete to authenticated
  using (public.has_org_role(organization_id, array['admin', 'analyst']::public.org_role[]) or created_by = (select auth.uid()));

create policy ioc_results_select on public.ioc_analysis_results for select to authenticated
  using (exists (select 1 from public.ioc_indicators i where i.id = indicator_id and public.is_org_member(i.organization_id)));
create policy ioc_results_insert on public.ioc_analysis_results for insert to authenticated
  with check (exists (select 1 from public.ioc_indicators i where i.id = indicator_id and public.is_org_member(i.organization_id)));

create policy phishing_select on public.phishing_analyses for select to authenticated using (public.is_org_member(organization_id));
create policy phishing_insert on public.phishing_analyses for insert to authenticated
  with check (public.is_org_member(organization_id) and is_demo = false
              and (case_id is null or public.can_write_case(case_id)));
create policy phishing_update on public.phishing_analyses for update to authenticated
  using (public.has_org_role(organization_id, array['admin', 'analyst']::public.org_role[]) or created_by = (select auth.uid()))
  with check (public.is_org_member(organization_id) and (case_id is null or public.can_write_case(case_id)));
create policy phishing_delete on public.phishing_analyses for delete to authenticated
  using (public.has_org_role(organization_id, array['admin', 'analyst']::public.org_role[]) or created_by = (select auth.uid()));

create policy domain_select on public.domain_analyses for select to authenticated using (public.is_org_member(organization_id));
create policy domain_insert on public.domain_analyses for insert to authenticated
  with check (public.is_org_member(organization_id) and is_demo = false
              and (case_id is null or public.can_write_case(case_id)));
create policy domain_update on public.domain_analyses for update to authenticated
  using (public.has_org_role(organization_id, array['admin', 'analyst']::public.org_role[]) or created_by = (select auth.uid()))
  with check (public.is_org_member(organization_id) and (case_id is null or public.can_write_case(case_id)));
create policy domain_delete on public.domain_analyses for delete to authenticated
  using (public.has_org_role(organization_id, array['admin', 'analyst']::public.org_role[]) or created_by = (select auth.uid()));

create policy queries_select on public.osint_queries for select to authenticated
  using (user_id = (select auth.uid()) or public.has_org_role(organization_id, array['admin']::public.org_role[]));
create policy queries_insert on public.osint_queries for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_org_member(organization_id));

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------
revoke execute on function public.log_activity(uuid, uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.log_activity(uuid, uuid, text, text, uuid, jsonb) to authenticated;
revoke execute on function public.record_integrity_check(uuid, boolean, text) from public, anon;
grant execute on function public.record_integrity_check(uuid, boolean, text) to authenticated;
revoke execute on function public.create_report_version(uuid) from public, anon;
grant execute on function public.create_report_version(uuid) to authenticated;
revoke execute on function public.recent_query_count(integer) from public, anon;
grant execute on function public.recent_query_count(integer) to authenticated;
revoke execute on function public.tg_audit_row() from public, anon, authenticated;
