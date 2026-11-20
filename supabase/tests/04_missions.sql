-- Missioni guidate e Casi reali: secret keys, automatic checks on the linked
-- case, grading, ownership.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@alpha.test'),
  ('22222222-2222-2222-2222-222222222222', 'bob@beta.test');
insert into tests.ids values
  ('alice', '11111111-1111-1111-1111-111111111111'),
  ('bob',   '22222222-2222-2222-2222-222222222222'),
  ('caseA', 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('caseB', 'bbbbbbbb-0000-0000-0000-00000000000b');
insert into tests.ids select 'orgA', organization_id::text from public.organization_members where user_id = tests.id('alice');
insert into tests.ids select 'orgB', organization_id::text from public.organization_members where user_id = tests.id('bob');
insert into tests.ids select 'mission', id::text from public.missions where slug = 'primo-giorno-falsa-fattura';
insert into public.cases (id, organization_id, title, category, created_by, objective) values
  (tests.id('caseA'), tests.id('orgA'), 'Sollecito sospetto', 'phishing_investigation', tests.id('alice'),
   'Stabilire se l''email è malevola, se ha prodotto effetti e quali azioni servono'),
  (tests.id('caseB'), tests.id('orgB'), 'Caso di Bob', 'phishing_investigation', tests.id('bob'), null);

select ok((select count(*) from public.missions where kind = 'guided') >= 4 and (select count(*) from public.missions where kind = 'real_case') >= 9,
  'guided missions and real cases are loaded');

select tests.login_as(tests.id('alice'));
select ok((select count(*) from public.missions) >= 13, 'missions are readable by signed-in users');
select throws_ok($$select * from public.mission_keys$$, '42501', null, 'answer keys are not readable through the API');
select ok(not ((select content::text from public.missions where slug = 'primo-giorno-falsa-fattura') like '%"senior"%'),
  'senior notes are not part of the public content');

insert into tests.ids select 'run', public.start_mission(tests.id('mission'))::text;
select is((public.check_mission_step(tests.id('run'), 's1', '"b"') ->> 'passed')::boolean, false,
  'a step with an automatic check fails while no case is linked');
select throws_ok(format($$select public.link_mission_case(%L, %L)$$, tests.id('run'), tests.id('caseB')),
  '42501', null, 'a run cannot be linked to a case of another organization');
select lives_ok(format($$select public.link_mission_case(%L, %L)$$, tests.id('run'), tests.id('caseA')),
  'the analyst links her own case');

select is(public.check_mission_step(tests.id('run'), 's1', '"a"') -> 'correct', 'false'::jsonb,
  'a wrong checkpoint answer is graded as wrong but the step is passed');
select ok(public.check_mission_step(tests.id('run'), 's1', '"b"') ->> 'senior' is not null,
  'the senior note is released once the step is passed');
select is((select steps -> 's1' ->> 'correct' from public.mission_runs where id = tests.id('run')), 'false',
  'only the first answer counts for the score');

select is((public.check_mission_step(tests.id('run'), 's3', '["spf","dmarc","reply","attach"]') ->> 'passed')::boolean, false,
  'the phishing step fails until an analysis with a verdict is linked to the case');
insert into public.phishing_analyses (organization_id, case_id, title, input_mode, raw_message, verdict)
values (tests.id('orgA'), tests.id('caseA'), 'Analisi', 'paste', 'From: a@b.example' || chr(10) || chr(10) || 'testo di prova lungo', 'malicious');
select is(public.check_mission_step(tests.id('run'), 's3', '["attach","reply","dmarc","spf"]') -> 'correct', 'true'::jsonb,
  'the automatic check passes after the real work and multi answers are graded regardless of order');

select ok((public.get_mission_notes(tests.id('run')) ? 's3') and not (public.get_mission_notes(tests.id('run')) ? 's7'),
  'notes are returned only for passed steps');
select throws_ok(format($$select public.complete_mission(%L)$$, tests.id('run')), '23514', null,
  'the debrief stays locked until every step is done');

select tests.login_as(tests.id('bob'));
select is_empty($$select 1 from public.mission_runs$$, 'runs of other users are invisible');
select throws_ok(format($$select public.check_mission_step(%L, 's1', '"b"')$$, tests.id('run')), '42501', null,
  'a user cannot work on someone else''s run');

select tests.logout();
select * from finish();
rollback;
