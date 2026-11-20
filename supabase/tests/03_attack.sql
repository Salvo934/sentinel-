-- MITRE ATT&CK: read-only reference data and case mapping isolation.
-- Requires the dataset to be loaded (scripts/db/test-local.sh loads it).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@alpha.test'),
  ('22222222-2222-2222-2222-222222222222', 'bob@beta.test');
insert into tests.ids values
  ('alice', '11111111-1111-1111-1111-111111111111'),
  ('bob',   '22222222-2222-2222-2222-222222222222'),
  ('caseA', 'aaaaaaaa-0000-0000-0000-00000000000a');
insert into tests.ids select 'orgA', organization_id::text from public.organization_members where user_id = tests.id('alice');
insert into public.cases (id, organization_id, title, category, created_by)
values (tests.id('caseA'), tests.id('orgA'), 'Caso A', 'phishing_investigation', tests.id('alice'));

select ok((select count(*) from public.attack_tactics) = 15, 'the 15 enterprise tactics are loaded');
select ok((select count(*) from public.attack_techniques where id = 'T1566.001' and parent_id = 'T1566') = 1,
  'sub-techniques reference their parent');

select tests.login_as(tests.id('alice'));
select ok((select count(*) from public.attack_techniques) > 600, 'signed-in users can read the knowledge base');
select throws_ok($$update public.attack_techniques set name = 'x' where id = 'T1566'$$, '42501', null,
  'the knowledge base is read-only through the API');
select throws_ok($$select public.load_attack_bundle('{}'::jsonb)$$, '42501', null,
  'the dataset loader is not callable through the API');
select lives_ok(format($$insert into public.case_attack_techniques (case_id, technique_id, info_status, confidence, observation)
  values (%L, 'T1566.002', 'verified_fact', 'high', 'Link di phishing nel messaggio')$$, tests.id('caseA')),
  'an analyst can map a technique onto a case');
select throws_ok(format($$insert into public.case_attack_techniques (case_id, technique_id) values (%L, 'T9999')$$, tests.id('caseA')),
  null, null, 'unknown technique ids are rejected');
select is((select (cases, verified) from public.attack_usage(tests.id('orgA')) where technique_id = 'T1566.002'),
  (1::bigint, 1::bigint), 'attack_usage counts mapped and verified cases');
select ok((select count(*) from public.audit_logs where action = 'attack_mapping.created') = 1,
  'mappings are recorded in the audit log');
select ok((select public.seed_demo_data(tests.id('orgA')) is not null) and public.seed_demo_attack(tests.id('orgA')) = 7,
  'demo data includes ATT&CK mappings for the demo cases');

select tests.login_as(tests.id('bob'));
select is_empty($$select 1 from public.case_attack_techniques$$, 'mappings of another organization are invisible');
select throws_ok(format($$insert into public.case_attack_techniques (case_id, technique_id) values (%L, 'T1566')$$, tests.id('caseA')),
  '42501', null, 'a user cannot map techniques onto a foreign case');
select is(tests.affected($$delete from public.case_attack_techniques$$), 0, 'a user cannot delete foreign mappings');

select tests.logout();
select * from finish();
rollback;
