-- Tenant isolation, application roles, audit log and demo mode.
-- Every assertion runs as a real API role (authenticated / anon) with a JWT
-- claim, exactly as PostgREST does.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

create schema tests;
grant usage on schema tests to anon, authenticated;
create table tests.ids (key text primary key, value text not null);
grant all on table tests.ids to anon, authenticated;
create function tests.id(p_key text) returns uuid language sql stable as $$
  select value::uuid from tests.ids where key = p_key;
$$;
create function tests.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.login_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function tests.affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on all functions in schema tests to anon, authenticated;

-- Fixtures: alice & bob each get a personal organization (trigger).
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@alpha.test', '{"full_name":"Alice Alpha"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@beta.test',    '{"full_name":"Bob Beta"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@alpha.test', '{"full_name":"Carol Trainee"}'),
  ('44444444-4444-4444-4444-444444444444', 'dave@alpha.test',  '{"full_name":"Dave Analyst"}');
insert into tests.ids values
  ('alice', '11111111-1111-1111-1111-111111111111'),
  ('bob',   '22222222-2222-2222-2222-222222222222'),
  ('carol', '33333333-3333-3333-3333-333333333333'),
  ('dave',  '44444444-4444-4444-4444-444444444444');
insert into tests.ids select 'orgA', organization_id::text from public.organization_members where user_id = tests.id('alice');
insert into tests.ids select 'orgB', organization_id::text from public.organization_members where user_id = tests.id('bob');
insert into public.organization_members (organization_id, user_id, role) values
  (tests.id('orgA'), tests.id('carol'), 'trainee'),
  (tests.id('orgA'), tests.id('dave'), 'analyst');

-- ---------------------------------------------------------------------------
select is((select count(*) from public.profiles where id = tests.id('alice') and role = 'analyst'), 1::bigint,
  'signup creates a profile with the default (non-admin) platform role');
select is((select role::text from public.organization_members where user_id = tests.id('alice')), 'admin',
  'signup creates a personal organization administered by the new user');

-- Alice (admin of A) creates a case -------------------------------------------
select tests.login_as(tests.id('alice'));
select lives_ok(format($$insert into public.cases (id, organization_id, title, category)
  values ('aaaaaaaa-0000-0000-0000-000000000001', %L, 'Indagine riservata A', 'osint_investigation')$$, tests.id('orgA')),
  'an admin can create a case in their organization');
select is((select created_by from public.cases where id = 'aaaaaaaa-0000-0000-0000-000000000001'), tests.id('alice'),
  'created_by is forced to the caller');
select is((select count(*) from public.organizations), 1::bigint, 'alice sees only her organization');
select throws_ok($$update public.profiles set role = 'administrator' where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'a user cannot grant themselves the administrator platform role');
select throws_ok(format($$insert into public.organization_members (organization_id, user_id, role)
  values (%L, '22222222-2222-2222-2222-222222222222', 'admin')$$, tests.id('orgA')),
  '42501', null, 'memberships cannot be inserted directly from the API');
select throws_ok($$delete from public.audit_logs$$, '42501', null, 'audit logs cannot be deleted through the API');
select ok((select count(*) from public.audit_logs where action = 'case.created'
           and entity_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1,
  'case creation is recorded in the audit log');

-- Bob (other organization) ------------------------------------------------------
select tests.login_as(tests.id('bob'));
select is_empty($$select 1 from public.cases where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'a user of another organization cannot read the case');
select throws_ok(format($$insert into public.cases (organization_id, title, category)
  values (%L, 'Intrusione', 'osint_investigation')$$, tests.id('orgA')),
  '42501', null, 'a user cannot create cases in an organization they do not belong to');
select is(tests.affected($$update public.cases set title = 'pwned' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$), 0,
  'a user cannot modify another organization''s case');
select is_empty(format($$select 1 from public.audit_logs where organization_id = %L$$, tests.id('orgA')),
  'a user cannot read another organization''s audit log');
select throws_ok(format($$select public.log_activity(%L, null, 'export.pdf', 'report', null)$$, tests.id('orgA')),
  '42501', null, 'log_activity refuses organizations the caller is not a member of');
select throws_ok(format($$select public.seed_demo_data(%L)$$, tests.id('orgA')),
  '42501', null, 'demo data cannot be loaded into a foreign organization');

-- Carol (trainee in A) -----------------------------------------------------------
select tests.login_as(tests.id('carol'));
select is((select count(*) from public.cases where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1::bigint,
  'a trainee can read the cases of her organization');
select is(tests.affected($$update public.cases set title = 'modificato' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$), 0,
  'a trainee cannot modify a case created by someone else');
select throws_ok($$insert into public.case_tasks (case_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Task trainee')$$,
  '42501', null, 'a trainee cannot add tasks to a case created by someone else');
select throws_ok(format($$select public.set_member_role(%L, '33333333-3333-3333-3333-333333333333', 'admin')$$, tests.id('orgA')),
  '42501', null, 'a trainee cannot promote herself to admin');
select is_empty($$select 1 from public.audit_logs where user_id is distinct from '33333333-3333-3333-3333-333333333333'$$,
  'a trainee only sees her own audit entries');
select lives_ok(format($$insert into public.cases (id, organization_id, title, category)
  values ('aaaaaaaa-0000-0000-0000-000000000002', %L, 'Esercizio trainee', 'investigation_training')$$, tests.id('orgA')),
  'a trainee can open her own training case');
select lives_ok($$insert into public.case_tasks (case_id, title) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Mio task')$$,
  'a trainee can add tasks to her own case');

-- Dave (analyst in A) --------------------------------------------------------------
select tests.login_as(tests.id('dave'));
select lives_ok($$insert into public.case_tasks (case_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Verifica DNS')$$,
  'an analyst can add tasks to any case of the organization');
select is(tests.affected($$delete from public.cases where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$), 0,
  'an analyst cannot delete cases');

-- Controlled deletion ---------------------------------------------------------------
select tests.login_as(tests.id('alice'));
select is(tests.affected($$delete from public.cases where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$), 0,
  'an admin cannot delete a case that has not been archived');
select is(tests.affected($$update public.cases set status = 'archived' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$), 1,
  'an admin can archive a case');
select throws_ok($$insert into public.case_tasks (case_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Dopo archiviazione')$$,
  '42501', null, 'archived cases are read-only');

-- Demo mode & dashboard ----------------------------------------------------------------
select lives_ok(format($$select public.seed_demo_data(%L)$$, tests.id('orgA')), 'an admin can load demo data');
select ok((public.dashboard_stats(tests.id('orgA')) ->> 'cases_open')::int >= 2 and
          (public.dashboard_stats(tests.id('orgA'), false) ->> 'iocs_total')::int = 0,
  'dashboard statistics include demo data only when requested');

select tests.login_anon();
select throws_ok($$select * from public.cases$$, '42501', null, 'anonymous callers have no access to cases');

select tests.logout();
select * from finish();
rollback;
