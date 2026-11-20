-- =============================================================================
-- Sentinel Intelligence — 002 Identity, tenancy and audit log
--
-- Model: every piece of investigative data belongs (directly or through a
-- case) to an organization. Users reach data only through
-- organization_members. Roles are changed exclusively through
-- SECURITY DEFINER functions that check the caller's privileges, so a user
-- cannot grant themselves admin rights by editing rows from the browser.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (char_length(full_name) <= 120),
  role        public.app_role not null default 'analyst',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on column public.profiles.role is
  'Platform role. Not writable by the user: change it with public.set_platform_role() as an administrator.';

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.org_role not null default 'analyst',
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

-- Append-only audit trail. No foreign keys on purpose: log rows must survive
-- the deletion of the user, case or entity they describe.
create table public.audit_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid not null,
  case_id         uuid,
  user_id         uuid,
  action          text not null check (char_length(action) <= 80),
  entity_type     text not null check (char_length(entity_type) <= 60),
  entity_id       uuid,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_case_idx on public.audit_logs (case_id, created_at desc) where case_id is not null;
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so they can be used inside RLS
-- policies without recursive policy evaluation).
-- -----------------------------------------------------------------------------
create function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create function public.has_org_role(p_org uuid, p_roles public.org_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'administrator'
  );
$$;

-- Do two users share at least one organization? (lets analysts see the
-- names of their colleagues, and nobody else's).
create function public.shares_org_with(p_user uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members a
    join public.organization_members b on b.organization_id = a.organization_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

-- -----------------------------------------------------------------------------
-- Audit writer (internal) and client-side activity logger (public RPC).
-- -----------------------------------------------------------------------------
create function public.write_audit(
  p_org uuid, p_case uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb
)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.audit_logs (organization_id, case_id, user_id, action, entity_type, entity_id, metadata)
  values (p_org, p_case, (select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;
revoke execute on function public.write_audit(uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated;

-- Lets the app record events that are not row changes (PDF export, evidence
-- download, integrity check...). The action is always prefixed with
-- "client." so it can never be mistaken for a database-generated event.
create function public.log_activity(
  p_org uuid, p_case uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_org_member(p_org) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_action !~ '^[a-z_]+(\.[a-z_]+)*$' or char_length(p_action) > 60 then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  if p_case is not null and not exists (
    select 1 from public.cases c where c.id = p_case and c.organization_id = p_org
  ) then
    raise exception 'case not in organization' using errcode = '42501';
  end if;
  perform public.write_audit(p_org, p_case, 'client.' || p_action, p_entity_type, p_entity_id,
                             coalesce(p_metadata, '{}'::jsonb) - 'user_id');
end;
$$;

-- Audit rows are immutable for everybody using the API.
create function public.tg_audit_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.tg_audit_immutable();

-- -----------------------------------------------------------------------------
-- New-user bootstrap: profile + personal organization (the user is its admin).
-- -----------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
begin
  insert into public.profiles (id, full_name) values (new.id, left(v_name, 120));

  insert into public.organizations (name, created_by)
  values (left('Workspace di ' || coalesce(v_name, split_part(coalesce(new.email, 'analista'), '@', 1)), 120), new.id)
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role) values (v_org, new.id, 'admin');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Role management RPCs
-- -----------------------------------------------------------------------------
create function public.set_platform_role(p_user uuid, p_role public.app_role)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'only platform administrators can change platform roles' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user;
end;
$$;

create function public.set_member_role(p_org uuid, p_user uuid, p_role public.org_role)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.has_org_role(p_org, array['admin']::public.org_role[]) then
    raise exception 'only organization admins can change roles' using errcode = '42501';
  end if;
  if p_role <> 'admin' and (
    select count(*) from public.organization_members
    where organization_id = p_org and role = 'admin' and user_id <> p_user
  ) = 0 then
    raise exception 'an organization must keep at least one admin' using errcode = '23514';
  end if;
  update public.organization_members set role = p_role
  where organization_id = p_org and user_id = p_user;
  perform public.write_audit(p_org, null, 'member.role_changed', 'organization_member', p_user,
                             jsonb_build_object('role', p_role));
end;
$$;

create function public.add_member_by_email(p_org uuid, p_email text, p_role public.org_role default 'analyst')
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.has_org_role(p_org, array['admin']::public.org_role[]) then
    raise exception 'only organization admins can add members' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'no registered user with this email' using errcode = 'P0002';
  end if;
  insert into public.organization_members (organization_id, user_id, role)
  values (p_org, v_user, p_role)
  on conflict (organization_id, user_id) do nothing;
  perform public.write_audit(p_org, null, 'member.added', 'organization_member', v_user,
                             jsonb_build_object('role', p_role));
  return v_user;
end;
$$;

-- Guard against role changes through any path other than the RPCs above.
create function public.tg_profiles_protect_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'supabase_admin', 'service_role')
     and not public.is_platform_admin() then
    raise exception 'role cannot be changed by the user' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.tg_profiles_protect_role();

-- -----------------------------------------------------------------------------
-- Privileges & RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.profiles, public.organizations, public.organization_members, public.audit_logs
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select on public.audit_logs to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_org_with(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy organizations_select on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy organizations_update_admin on public.organizations for update to authenticated
  using (public.has_org_role(id, array['admin']::public.org_role[]))
  with check (public.has_org_role(id, array['admin']::public.org_role[]));

create policy members_select on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id));

-- Admins and analysts read the whole organization trail; trainees only their own.
create policy audit_select on public.audit_logs for select to authenticated
  using (
    public.has_org_role(organization_id, array['admin', 'analyst']::public.org_role[])
    or (user_id = (select auth.uid()) and public.is_org_member(organization_id))
  );

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_platform_role(uuid, public.app_role) from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, public.org_role) from public, anon;
revoke execute on function public.add_member_by_email(uuid, text, public.org_role) from public, anon;
grant execute on function public.set_platform_role(uuid, public.app_role) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, public.org_role) to authenticated;
grant execute on function public.add_member_by_email(uuid, text, public.org_role) to authenticated;
