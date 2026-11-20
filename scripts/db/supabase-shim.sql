-- =============================================================================
-- LOCAL TESTING ONLY — never applied to a real Supabase project.
-- Recreates the small part of the Supabase platform the migrations depend on,
-- so they can run on a plain PostgreSQL (no Docker): roles, auth schema,
-- auth.uid()/auth.jwt(), the extensions schema and Supabase's default grants.
-- =============================================================================

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create schema extensions;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz,
  is_anonymous       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create function auth.role() returns text language sql stable as $$
  select nullif(auth.jwt() ->> 'role', '');
$$;

grant execute on function auth.jwt(), auth.uid(), auth.role() to anon, authenticated, service_role;

-- Supabase grants everything in `public` to the API roles by default; the
-- migrations must revoke what they do not want. Reproduce that here.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
