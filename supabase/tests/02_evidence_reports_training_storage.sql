-- Evidence integrity, report versioning, Training Academy secrecy, storage policies.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

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
  ('22222222-2222-2222-2222-222222222222', 'bob@beta.test'),
  ('44444444-4444-4444-4444-444444444444', 'dave@alpha.test');
insert into tests.ids values
  ('alice', '11111111-1111-1111-1111-111111111111'),
  ('bob',   '22222222-2222-2222-2222-222222222222'),
  ('dave',  '44444444-4444-4444-4444-444444444444'),
  ('caseA', 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('caseB', 'bbbbbbbb-0000-0000-0000-00000000000b');
insert into tests.ids select 'orgA', organization_id::text from public.organization_members where user_id = tests.id('alice');
insert into tests.ids select 'orgB', organization_id::text from public.organization_members where user_id = tests.id('bob');
insert into public.organization_members (organization_id, user_id, role) values (tests.id('orgA'), tests.id('dave'), 'analyst');
insert into public.cases (id, organization_id, title, category, created_by) values
  (tests.id('caseA'), tests.id('orgA'), 'Caso A', 'phishing_investigation', tests.id('alice')),
  (tests.id('caseB'), tests.id('orgB'), 'Caso B', 'phishing_investigation', tests.id('bob'));

-- Training fixture (catalogue + secret answer key)
insert into public.training_scenarios (id, slug, title, description, difficulty, category, estimated_minutes, content)
values ('cccccccc-0000-0000-0000-00000000000c', 'test-scenario', 'Scenario', 'Descrizione', 'beginner',
        'investigation_training', 30, '{"questions": []}');
insert into public.training_answer_keys (scenario_id, answer_key, solution) values
  ('cccccccc-0000-0000-0000-00000000000c',
   '{"q1": {"type": "single", "correct": "b", "points": 2, "explanation": "B"},
     "q2": {"type": "multi", "correct": ["x", "y"], "points": 2},
     "q3": {"type": "keywords", "keywords": [["spf"], ["dmarc"]], "points": 2}}',
   '{"summary": "soluzione guidata"}');

-- Grading function (pure) ---------------------------------------------------------
select is((public.grade_training_answers(
  (select answer_key from public.training_answer_keys where scenario_id = 'cccccccc-0000-0000-0000-00000000000c'),
  '{"q1": "b", "q2": ["x", "z"], "q3": "SPF fallito, DKIM assente"}') ->> 'score')::numeric, 3::numeric,
  'grading: single correct (2) + multi one hit one wrong (0) + keywords half (1)');

-- Evidence -------------------------------------------------------------------------
select tests.login_as(tests.id('dave'));
select lives_ok(format($$insert into public.evidence (id, case_id, title, storage_path, sha256_hash)
  values ('eeeeeeee-0000-0000-0000-00000000000e', %L, 'Email originale', %L, %L)$$,
  tests.id('caseA'), tests.id('orgA') || '/' || tests.id('caseA') || '/x-mail.eml', repeat('a', 64)),
  'an analyst can register evidence with its SHA-256');
select throws_ok($$update public.evidence set sha256_hash = repeat('b', 64) where id = 'eeeeeeee-0000-0000-0000-00000000000e'$$,
  '42501', null, 'the evidence hash is write-once');
select throws_ok(format($$insert into public.evidence (case_id, title, storage_path)
  values (%L, 'Senza hash', 'x/y/z')$$, tests.id('caseA')),
  '23514', null, 'a stored file always requires a hash');
select lives_ok($$update public.evidence set notes = 'annotazione' where id = 'eeeeeeee-0000-0000-0000-00000000000e'$$,
  'evidence notes can be updated');
select is(tests.affected($$delete from public.evidence where id = 'eeeeeeee-0000-0000-0000-00000000000e'$$), 0,
  'an analyst cannot delete evidence');
select throws_ok(format($$insert into public.ioc_indicators (organization_id, case_id, indicator_type, indicator_value)
  values (%L, %L, 'domain', 'evil.example')$$, tests.id('orgA'), tests.id('caseB')),
  null, null, 'an IOC cannot be linked to a case of another organization');

select tests.login_as(tests.id('bob'));
select is_empty($$select 1 from public.evidence$$, 'evidence of another organization is invisible');

select tests.login_as(tests.id('alice'));
select is(tests.affected($$delete from public.evidence where id = 'eeeeeeee-0000-0000-0000-00000000000e'$$), 1,
  'an organization admin can delete evidence');

-- Reports ----------------------------------------------------------------------------
select lives_ok(format($$insert into public.reports (id, case_id, report_type, title, content)
  values ('dddddddd-0000-0000-0000-00000000000d', %L, 'phishing_investigation', 'Report phishing', '{"conclusions": "bozza"}')$$,
  tests.id('caseA')), 'a draft report can be created');
select throws_ok(format($$insert into public.reports (case_id, report_type, title, status)
  values (%L, 'phishing_investigation', 'Finale diretto', 'final')$$, tests.id('caseA')),
  '42501', null, 'reports must be created as drafts');
select is(tests.affected($$update public.reports set status = 'final' where id = 'dddddddd-0000-0000-0000-00000000000d'$$), 1,
  'a draft can be finalized');
select throws_ok($$update public.reports set content = '{"conclusions": "riscritto"}' where id = 'dddddddd-0000-0000-0000-00000000000d'$$,
  '42501', null, 'final reports are immutable');
select is(tests.affected($$update public.reports set storage_path = 'org/case/r.pdf' where id = 'dddddddd-0000-0000-0000-00000000000d'$$), 1,
  'the exported PDF path can still be attached to a final report');
insert into tests.ids select 'v2', public.create_report_version(
  (select report_key from public.reports where id = 'dddddddd-0000-0000-0000-00000000000d'))::text;
select is((select version from public.reports where id = tests.id('v2')), 2,
  'a new version is created from the latest one');

-- Training Academy ------------------------------------------------------------------------
select tests.login_as(tests.id('dave'));
select is((select count(*) from public.training_scenarios where slug in ('test-scenario', 'phishing-email-investigation')), 2::bigint, 'scenarios are readable by every user');
select throws_ok($$select * from public.training_answer_keys$$, '42501', null, 'answer keys are not readable through the API');
select throws_ok($$select public.get_training_solution('cccccccc-0000-0000-0000-00000000000c')$$,
  '42501', null, 'the guided solution is locked before submission');
insert into tests.ids select 'attempt', public.start_training_attempt('cccccccc-0000-0000-0000-00000000000c')::text;
select is(tests.affected(format($$update public.training_attempts set answers = '{"q1": "b"}', submitted_content = 'breve' where id = %L$$,
  tests.id('attempt'))), 1, 'the user saves answers on an open attempt');
select throws_ok(format($$update public.training_attempts set score = 100 where id = %L$$, tests.id('attempt')),
  '42501', null, 'the score cannot be written by the user');
select throws_ok(format($$select public.submit_training_attempt(%L)$$, tests.id('attempt')),
  '23514', null, 'a deliverable shorter than 50 characters is rejected');
select lives_ok(format($$update public.training_attempts set submitted_content = repeat('Analisi motivata. ', 5) where id = %L$$,
  tests.id('attempt')) || '; ' || format($$select public.submit_training_attempt(%L)$$, tests.id('attempt')),
  'a complete attempt can be submitted');
select is((select score from public.training_attempts where id = tests.id('attempt')), 2.00::numeric(5,2),
  'the server computes the score');
select is(tests.affected(format($$update public.training_attempts set answers = '{"q1": "a"}' where id = %L$$, tests.id('attempt'))), 0,
  'submitted attempts are frozen');
select is(public.get_training_solution('cccccccc-0000-0000-0000-00000000000c') ->> 'summary', 'soluzione guidata',
  'the guided solution is released after submission');

-- Storage ----------------------------------------------------------------------------------
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('investigation-evidence', %L)$$,
  tests.id('orgA') || '/' || tests.id('caseA') || '/f-shot.png'), 'an analyst can upload evidence files for an accessible case');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('investigation-evidence', %L)$$,
  tests.id('orgB') || '/' || tests.id('caseB') || '/f-intrusion.png'), '42501', null,
  'uploads to another organization''s case folder are refused');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('user-exports', %L)$$,
  tests.id('alice') || '/export.json'), '42501', null, 'users cannot write into another user''s export folder');

select tests.logout();
select * from finish();
rollback;
