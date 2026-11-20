-- =============================================================================
-- Sentinel Intelligence — 009 MITRE ATT&CK knowledge base and case mapping
--
-- Reference data (tactics, techniques, mitigations, detection strategies,
-- groups) is imported from the official MITRE ATT&CK STIX dataset by
-- scripts/attack/build-attack-dataset.py and loaded with
-- public.load_attack_bundle(). It is read-only through the
-- API. Analysts map techniques onto cases in case_attack_techniques, with
-- the same fact/hypothesis discipline used elsewhere in the platform.
--
-- © The MITRE Corporation. This work is reproduced and distributed with the
-- permission of The MITRE Corporation (ATT&CK Terms of Use).
-- =============================================================================

create table public.attack_meta (
  id          smallint primary key default 1 check (id = 1),
  domain      text not null,
  version     text not null,
  modified    timestamptz,
  imported_at timestamptz not null default now(),
  attribution text not null
);

create table public.attack_tactics (
  id          text primary key check (id ~ '^TA[0-9]{4}$'),
  stix_id     text not null unique,
  name        text not null,
  shortname   text not null unique,
  description text not null,
  sort_order  smallint not null,
  url         text not null
);

create table public.attack_techniques (
  id              text primary key check (id ~ '^T[0-9]{4}(\.[0-9]{3})?$'),
  stix_id         text not null unique,
  name            text not null,
  description     text not null,
  is_subtechnique boolean not null,
  parent_id       text references public.attack_techniques (id),
  tactics         text[] not null default '{}',   -- tactic shortnames
  platforms       text[] not null default '{}',
  url             text not null,
  version         text,
  modified        timestamptz,
  search          tsvector generated always as (
                    to_tsvector('simple', id || ' ' || name || ' ' || left(description, 2000))
                  ) stored,
  constraint attack_sub_has_parent check (is_subtechnique = (parent_id is not null))
);
create index attack_techniques_parent_idx on public.attack_techniques (parent_id);
create index attack_techniques_tactics_idx on public.attack_techniques using gin (tactics);
create index attack_techniques_search_idx on public.attack_techniques using gin (search);

create table public.attack_mitigations (
  id          text primary key check (id ~ '^M[0-9]{4}$'),
  stix_id     text not null unique,
  name        text not null,
  description text not null,
  url         text not null
);

create table public.attack_technique_mitigations (
  technique_id  text not null references public.attack_techniques (id) on delete cascade,
  mitigation_id text not null references public.attack_mitigations (id) on delete cascade,
  description   text,
  primary key (technique_id, mitigation_id)
);
create index attack_technique_mitigations_mit_idx on public.attack_technique_mitigations (mitigation_id);

create table public.attack_detection_strategies (
  id           text primary key check (id ~ '^DET[0-9]{4}$'),
  technique_id text not null references public.attack_techniques (id) on delete cascade,
  name         text not null,
  analytics    jsonb not null default '[]'::jsonb,  -- [{ "id", "platforms", "description" }]
  url          text not null
);
create index attack_detection_strategies_tech_idx on public.attack_detection_strategies (technique_id);

create table public.attack_groups (
  id          text primary key check (id ~ '^G[0-9]{4}$'),
  stix_id     text not null unique,
  name        text not null,
  aliases     text[] not null default '{}',
  description text not null,
  url         text not null
);

create table public.attack_group_techniques (
  group_id     text not null references public.attack_groups (id) on delete cascade,
  technique_id text not null references public.attack_techniques (id) on delete cascade,
  primary key (group_id, technique_id)
);
create index attack_group_techniques_tech_idx on public.attack_group_techniques (technique_id);

-- -----------------------------------------------------------------------------
-- Case mapping (organization data, protected by the case's RLS)
-- -----------------------------------------------------------------------------
create table public.case_attack_techniques (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases (id) on delete cascade,
  technique_id text not null references public.attack_techniques (id) on delete restrict,
  info_status  public.info_status not null default 'hypothesis',
  confidence   public.confidence_level not null default 'low',
  observation  text check (char_length(observation) <= 4000),
  evidence_id  uuid references public.evidence (id) on delete set null,
  source       text check (char_length(source) <= 120),  -- 'manual', 'phishing_lab', 'domain_analysis', 'attack_page', 'demo'
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (case_id, technique_id)
);
create index case_attack_techniques_tech_idx on public.case_attack_techniques (technique_id);

create function public.tg_case_attack_evidence_same_case()
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

create trigger case_attack_evidence before insert or update on public.case_attack_techniques
  for each row execute function public.tg_case_attack_evidence_same_case();
create trigger case_attack_author before insert on public.case_attack_techniques
  for each row execute function public.tg_force_author('created_by');
create trigger case_attack_updated_at before update on public.case_attack_techniques
  for each row execute function public.tg_set_updated_at();
create trigger audit_case_attack after insert or update or delete on public.case_attack_techniques
  for each row execute function public.tg_audit_row('attack_mapping');

revoke execute on function public.tg_case_attack_evidence_same_case() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Privileges & RLS
-- -----------------------------------------------------------------------------
alter table public.attack_meta enable row level security;
alter table public.attack_tactics enable row level security;
alter table public.attack_techniques enable row level security;
alter table public.attack_mitigations enable row level security;
alter table public.attack_technique_mitigations enable row level security;
alter table public.attack_detection_strategies enable row level security;
alter table public.attack_groups enable row level security;
alter table public.attack_group_techniques enable row level security;
alter table public.case_attack_techniques enable row level security;

revoke all on public.attack_meta, public.attack_tactics, public.attack_techniques, public.attack_mitigations,
  public.attack_technique_mitigations, public.attack_detection_strategies, public.attack_groups,
  public.attack_group_techniques, public.case_attack_techniques
  from anon, authenticated;

-- Public reference data: read-only for signed-in users.
grant select on public.attack_meta, public.attack_tactics, public.attack_techniques, public.attack_mitigations,
  public.attack_technique_mitigations, public.attack_detection_strategies, public.attack_groups,
  public.attack_group_techniques
  to authenticated;

create policy attack_meta_read on public.attack_meta for select to authenticated using (true);
create policy attack_tactics_read on public.attack_tactics for select to authenticated using (true);
create policy attack_techniques_read on public.attack_techniques for select to authenticated using (true);
create policy attack_mitigations_read on public.attack_mitigations for select to authenticated using (true);
create policy attack_tech_mit_read on public.attack_technique_mitigations for select to authenticated using (true);
create policy attack_detection_read on public.attack_detection_strategies for select to authenticated using (true);
create policy attack_groups_read on public.attack_groups for select to authenticated using (true);
create policy attack_group_tech_read on public.attack_group_techniques for select to authenticated using (true);

grant select, insert, update, delete on public.case_attack_techniques to authenticated;
create policy case_attack_select on public.case_attack_techniques for select to authenticated
  using (public.can_read_case(case_id));
create policy case_attack_insert on public.case_attack_techniques for insert to authenticated
  with check (public.can_write_case(case_id));
create policy case_attack_update on public.case_attack_techniques for update to authenticated
  using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy case_attack_delete on public.case_attack_techniques for delete to authenticated
  using (public.can_write_case(case_id));

-- Heatmap: how many accessible cases of an organization map each technique.
-- SECURITY INVOKER, so the counts respect RLS.
create function public.attack_usage(p_org uuid, p_include_demo boolean default true)
returns table (technique_id text, cases bigint, verified bigint)
language sql stable security invoker
set search_path = ''
as $$
  select m.technique_id,
         count(distinct m.case_id),
         count(distinct m.case_id) filter (where m.info_status = 'verified_fact')
  from public.case_attack_techniques m
  join public.cases c on c.id = m.case_id
  where c.organization_id = p_org and (p_include_demo or not c.is_demo)
  group by m.technique_id;
$$;
revoke execute on function public.attack_usage(uuid, boolean) from public, anon;
grant execute on function public.attack_usage(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Dataset loader. Input: the compact JSON produced by
-- scripts/attack/build-attack-dataset.py (public/data/mitre-attack-enterprise.json).
-- Upserts everything; re-runnable for new ATT&CK releases. Not callable
-- through the API (no grants): run it as the database owner, e.g.
--   select public.load_attack_bundle((extensions.http_get('<app>/data/mitre-attack-enterprise.json')).content::jsonb);
-- -----------------------------------------------------------------------------
create function public.load_attack_bundle(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if p -> 'meta' ->> 'domain' is distinct from 'enterprise-attack' then
    raise exception 'unexpected ATT&CK bundle' using errcode = '22023';
  end if;

  insert into public.attack_meta (id, domain, version, modified, attribution)
  values (1, p->'meta'->>'domain', p->'meta'->>'version', (p->'meta'->>'modified')::timestamptz, p->'meta'->>'attribution')
  on conflict (id) do update set version = excluded.version, modified = excluded.modified,
    imported_at = now(), attribution = excluded.attribution;

  insert into public.attack_tactics (id, stix_id, name, shortname, description, sort_order, url)
  select id, stix_id, name, shortname, description, sort_order, url
  from jsonb_to_recordset(p->'tactics') as x(id text, stix_id text, name text, shortname text, description text, sort_order smallint, url text)
  on conflict (id) do update set name = excluded.name, shortname = excluded.shortname,
    description = excluded.description, sort_order = excluded.sort_order, url = excluded.url;

  -- Parents before sub-techniques (self-referencing FK).
  insert into public.attack_techniques (id, stix_id, name, description, is_subtechnique, parent_id, tactics, platforms, url, version, modified)
  select id, stix_id, name, description, is_subtechnique, parent_id,
         array(select jsonb_array_elements_text(tactics)), array(select jsonb_array_elements_text(platforms)),
         url, version, modified
  from jsonb_to_recordset(p->'techniques') as x(id text, stix_id text, name text, description text, is_subtechnique boolean,
       parent_id text, tactics jsonb, platforms jsonb, url text, version text, modified timestamptz)
  order by is_subtechnique, id
  on conflict (id) do update set name = excluded.name, description = excluded.description,
    is_subtechnique = excluded.is_subtechnique, parent_id = excluded.parent_id, tactics = excluded.tactics,
    platforms = excluded.platforms, url = excluded.url, version = excluded.version, modified = excluded.modified;

  insert into public.attack_mitigations (id, stix_id, name, description, url)
  select id, stix_id, name, description, url
  from jsonb_to_recordset(p->'mitigations') as x(id text, stix_id text, name text, description text, url text)
  on conflict (id) do update set name = excluded.name, description = excluded.description, url = excluded.url;

  insert into public.attack_groups (id, stix_id, name, aliases, description, url)
  select id, stix_id, name, array(select jsonb_array_elements_text(aliases)), description, url
  from jsonb_to_recordset(p->'groups') as x(id text, stix_id text, name text, aliases jsonb, description text, url text)
  on conflict (id) do update set name = excluded.name, aliases = excluded.aliases,
    description = excluded.description, url = excluded.url;

  -- Relationship tables are replaced wholesale (they carry no user data).
  delete from public.attack_technique_mitigations;
  insert into public.attack_technique_mitigations (technique_id, mitigation_id, description)
  select technique_id, mitigation_id, description
  from jsonb_to_recordset(p->'technique_mitigations') as x(technique_id text, mitigation_id text, description text)
  on conflict do nothing;

  delete from public.attack_group_techniques;
  insert into public.attack_group_techniques (group_id, technique_id)
  select group_id, technique_id
  from jsonb_to_recordset(p->'group_techniques') as x(group_id text, technique_id text)
  on conflict do nothing;

  delete from public.attack_detection_strategies;
  insert into public.attack_detection_strategies (id, technique_id, name, analytics, url)
  select id, technique_id, name, analytics, url
  from jsonb_to_recordset(p->'detections') as x(id text, technique_id text, name text, analytics jsonb, url text)
  on conflict (id) do nothing;

  return jsonb_build_object(
    'version', p->'meta'->>'version',
    'tactics', (select count(*) from public.attack_tactics),
    'techniques', (select count(*) from public.attack_techniques),
    'mitigations', (select count(*) from public.attack_mitigations),
    'groups', (select count(*) from public.attack_groups),
    'detections', (select count(*) from public.attack_detection_strategies));
end;
$$;
revoke execute on function public.load_attack_bundle(jsonb) from public, anon, authenticated;

-- Number of documented techniques per group (aggregated server-side: the
-- relationship table exceeds the API's max rows per request).
create function public.attack_group_technique_counts()
returns table (group_id text, techniques bigint)
language sql stable security invoker
set search_path = ''
as $$
  select group_id, count(*) from public.attack_group_techniques group by group_id;
$$;
revoke execute on function public.attack_group_technique_counts() from public, anon;
grant execute on function public.attack_group_technique_counts() to authenticated;

-- Demo data: ATT&CK mappings on the demo cases (called after seed_demo_data;
-- rows disappear with the demo cases through the cascade).
create function public.seed_demo_attack(p_org uuid)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare n integer;
begin
  if not public.has_org_role(p_org, array['admin']::public.org_role[]) then
    raise exception 'only organization admins can load demo data' using errcode = '42501';
  end if;
  insert into public.case_attack_techniques (case_id, technique_id, info_status, confidence, observation, source)
  select c.id, m.technique_id, m.info_status::public.info_status, m.confidence::public.confidence_level, m.observation, 'demo'
  from public.cases c
  join (values
    ('phishing_investigation', 'T1566.002', 'verified_fact', 'high', '[DEMO] Link a pagina di login esterna nel corpo dell''email.'),
    ('phishing_investigation', 'T1684.001', 'verified_fact', 'moderate', '[DEMO] Nome visualizzato del fornitore, Reply-To su altro dominio.'),
    ('phishing_investigation', 'T1598.003', 'hypothesis', 'moderate', '[DEMO] Probabile raccolta di credenziali: pagina non analizzata.'),
    ('brand_impersonation', 'T1583.001', 'verified_fact', 'high', '[DEMO] Dominio sosia registrato da meno di 30 giorni.'),
    ('brand_impersonation', 'T1608.005', 'hypothesis', 'low', '[DEMO] Name server di parcheggio: possibile pagina in preparazione.'),
    ('cyber_threat_intelligence', 'T1071.001', 'to_verify', 'moderate', '[DEMO] Dataset GreyHeron: comunicazioni C2 su HTTPS.'),
    ('cyber_threat_intelligence', 'T1105', 'to_verify', 'low', '[DEMO] Dataset GreyHeron: download di strumenti aggiuntivi.')
  ) as m(category, technique_id, info_status, confidence, observation) on m.category = c.category::text
  where c.organization_id = p_org and c.is_demo
    and exists (select 1 from public.attack_techniques t where t.id = m.technique_id)
  on conflict (case_id, technique_id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.seed_demo_attack(uuid) from public, anon;
grant execute on function public.seed_demo_attack(uuid) to authenticated;
