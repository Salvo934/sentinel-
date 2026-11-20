-- =============================================================================
-- Sentinel Intelligence — 004 Training Academy
--
-- Scenarios are a shared catalogue readable by every signed-in user.
-- Answer keys and guided solutions live in a separate table with NO API
-- grants: they are only reachable through SECURITY DEFINER functions, and the
-- solution is released only after the user has submitted an attempt.
-- Scores are formative self-training indicators, not certifications.
-- =============================================================================

create table public.training_scenarios (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  sort_order        integer not null default 0,
  title             text not null,
  description       text not null,
  difficulty        text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  category          public.case_category not null,
  estimated_minutes integer not null check (estimated_minutes between 5 and 600),
  skills            text[] not null default '{}',
  -- scenario, briefing, objective, documents, dataset, tasks, tools,
  -- instructions, deliverable, questions (without answers)
  content           jsonb not null,
  grading_rubric    jsonb not null default '[]'::jsonb,
  is_published      boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger training_scenarios_updated_at before update on public.training_scenarios
  for each row execute function public.tg_set_updated_at();

create table public.training_answer_keys (
  scenario_id uuid primary key references public.training_scenarios (id) on delete cascade,
  answer_key  jsonb not null,  -- { "<question id>": { type, correct|keywords, points, explanation } }
  solution    jsonb not null   -- guided solution released after submission
);

create table public.training_attempts (
  id                uuid primary key default gen_random_uuid(),
  scenario_id       uuid not null references public.training_scenarios (id) on delete cascade,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status            public.attempt_status not null default 'in_progress',
  answers           jsonb not null default '{}'::jsonb,
  submitted_content text check (char_length(submitted_content) <= 50000),
  self_assessment   jsonb not null default '{}'::jsonb,
  score             numeric(5, 2),
  max_score         numeric(5, 2),
  feedback          jsonb,
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  updated_at        timestamptz not null default now()
);
create index training_attempts_user_idx on public.training_attempts (user_id, started_at desc);
create unique index training_attempts_one_open on public.training_attempts (user_id, scenario_id)
  where status = 'in_progress';
create trigger training_attempts_updated_at before update on public.training_attempts
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Grading (pure function, also unit-tested in supabase/tests)
-- -----------------------------------------------------------------------------
create function public.grade_training_answers(p_key jsonb, p_answers jsonb)
returns jsonb
language plpgsql immutable
set search_path = ''
as $$
declare
  q record;
  v_type text;
  v_points numeric;
  v_earned numeric;
  v_total numeric := 0;
  v_score numeric := 0;
  v_feedback jsonb := '{}'::jsonb;
  v_answer jsonb;
  v_correct jsonb;
  v_hits integer;
  v_wrong integer;
  v_text text;
  v_group jsonb;
  v_groups integer;
  v_matched integer;
begin
  for q in select key, value from jsonb_each(p_key) loop
    v_type := q.value ->> 'type';
    v_points := coalesce((q.value ->> 'points')::numeric, 1);
    v_answer := p_answers -> q.key;
    v_correct := q.value -> 'correct';
    v_earned := 0;

    if v_type = 'single' then
      if v_answer is not null and jsonb_typeof(v_answer) = 'string' and v_answer = v_correct then
        v_earned := v_points;
      end if;

    elsif v_type = 'multi' then
      if v_answer is not null and jsonb_typeof(v_answer) = 'array' then
        select count(*) filter (where v_correct ? a), count(*) filter (where not (v_correct ? a))
          into v_hits, v_wrong
          from (select distinct jsonb_array_elements_text(v_answer) as a) s;
        v_earned := round(v_points * greatest(0, v_hits - v_wrong)::numeric
                          / greatest(1, jsonb_array_length(v_correct)), 2);
      end if;

    elsif v_type = 'keywords' then
      -- "keywords" is a list of groups; a group is satisfied when any of its
      -- synonyms appears in the free-text answer.
      v_text := lower(coalesce(v_answer #>> '{}', ''));
      v_groups := jsonb_array_length(q.value -> 'keywords');
      v_matched := 0;
      for v_group in select value from jsonb_array_elements(q.value -> 'keywords') loop
        if exists (select 1 from jsonb_array_elements_text(v_group) k where position(lower(k) in v_text) > 0) then
          v_matched := v_matched + 1;
        end if;
      end loop;
      v_earned := round(v_points * v_matched::numeric / greatest(1, v_groups), 2);
    end if;

    v_total := v_total + v_points;
    v_score := v_score + v_earned;
    v_feedback := v_feedback || jsonb_build_object(q.key, jsonb_build_object(
      'earned', v_earned,
      'points', v_points,
      'correct', v_earned = v_points,
      'explanation', q.value ->> 'explanation'
    ));
  end loop;

  return jsonb_build_object('score', v_score, 'max_score', v_total, 'questions', v_feedback);
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------
create function public.start_training_attempt(p_scenario uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.training_scenarios where id = p_scenario and is_published) then
    raise exception 'scenario not found' using errcode = 'P0002';
  end if;
  select id into v_id from public.training_attempts
   where user_id = (select auth.uid()) and scenario_id = p_scenario and status = 'in_progress';
  if v_id is null then
    insert into public.training_attempts (scenario_id, user_id) values (p_scenario, (select auth.uid()))
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function public.submit_training_attempt(p_attempt uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_attempt public.training_attempts;
  v_key jsonb;
  v_result jsonb;
begin
  select * into v_attempt from public.training_attempts where id = p_attempt for update;
  if v_attempt.id is null or v_attempt.user_id <> (select auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt already submitted' using errcode = '23514';
  end if;
  if coalesce(char_length(btrim(v_attempt.submitted_content)), 0) < 50 then
    raise exception 'the analyst deliverable must contain at least 50 characters' using errcode = '23514';
  end if;

  select answer_key into v_key from public.training_answer_keys where scenario_id = v_attempt.scenario_id;
  v_result := public.grade_training_answers(coalesce(v_key, '{}'::jsonb), v_attempt.answers);

  update public.training_attempts
     set status = 'submitted',
         completed_at = now(),
         score = (v_result ->> 'score')::numeric,
         max_score = (v_result ->> 'max_score')::numeric,
         feedback = v_result -> 'questions'
   where id = p_attempt;
  return v_result;
end;
$$;

create function public.get_training_solution(p_scenario uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.training_attempts
    where scenario_id = p_scenario and user_id = (select auth.uid()) and status = 'submitted'
  ) then
    raise exception 'submit an attempt before viewing the guided solution' using errcode = '42501';
  end if;
  return (select solution from public.training_answer_keys where scenario_id = p_scenario);
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges & RLS
-- -----------------------------------------------------------------------------
alter table public.training_scenarios enable row level security;
alter table public.training_answer_keys enable row level security;
alter table public.training_attempts enable row level security;

revoke all on public.training_scenarios, public.training_answer_keys, public.training_attempts from anon, authenticated;
grant select on public.training_scenarios to authenticated;
grant select on public.training_attempts to authenticated;
grant update (answers, submitted_content, self_assessment) on public.training_attempts to authenticated;
grant delete on public.training_attempts to authenticated;
-- training_answer_keys: intentionally no grants and no policies.

create policy scenarios_select on public.training_scenarios for select to authenticated using (is_published);

create policy attempts_select_own on public.training_attempts for select to authenticated
  using (user_id = (select auth.uid()));
create policy attempts_update_own_open on public.training_attempts for update to authenticated
  using (user_id = (select auth.uid()) and status = 'in_progress')
  with check (user_id = (select auth.uid()) and status = 'in_progress');
create policy attempts_delete_own_open on public.training_attempts for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'in_progress');

revoke execute on function public.start_training_attempt(uuid) from public, anon;
revoke execute on function public.submit_training_attempt(uuid) from public, anon;
revoke execute on function public.get_training_solution(uuid) from public, anon;
revoke execute on function public.grade_training_answers(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.start_training_attempt(uuid) to authenticated;
grant execute on function public.submit_training_attempt(uuid) to authenticated;
grant execute on function public.get_training_solution(uuid) to authenticated;
