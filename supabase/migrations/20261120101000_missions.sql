-- =============================================================================
-- Sentinel Intelligence — 010 Missioni guidate e Casi reali
--
-- A mission is a realistic request worked step by step inside the real
-- modules. Each step can carry:
--   * an automatic check on the case linked to the run (did the analyst
--     really open the case, upload the evidence, map the technique...?);
--   * a checkpoint question (graded server-side);
--   * a senior analyst's note, released only once the step is passed.
-- Answer keys, senior notes and the final debrief live in mission_keys,
-- which has no API grants (same pattern as training_answer_keys).
-- =============================================================================

create table public.missions (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  kind              text not null check (kind in ('guided', 'real_case')),
  sort_order        integer not null default 0,
  title             text not null,
  summary           text not null,
  difficulty        text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  category          public.case_category not null,
  roles             text[] not null default '{}',
  estimated_minutes integer not null check (estimated_minutes between 5 and 600),
  -- request, context, dossier (real cases), materials, steps (without answers), sources
  content           jsonb not null,
  is_published      boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger missions_updated_at before update on public.missions
  for each row execute function public.tg_set_updated_at();

create table public.mission_keys (
  mission_id uuid primary key references public.missions (id) on delete cascade,
  steps      jsonb not null,   -- { "<step id>": { "correct": ..., "explanation": "...", "senior": "..." } }
  debrief    jsonb not null
);

create table public.mission_runs (
  id           uuid primary key default gen_random_uuid(),
  mission_id   uuid not null references public.missions (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  case_id      uuid references public.cases (id) on delete set null,
  status       text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  -- { "<step id>": { "done": true, "answer": ..., "correct": bool, "attempts": n, "completed_at": ts } }
  steps        jsonb not null default '{}'::jsonb,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  updated_at   timestamptz not null default now()
);
create index mission_runs_user_idx on public.mission_runs (user_id, started_at desc);
create unique index mission_runs_one_open on public.mission_runs (user_id, mission_id) where status = 'in_progress';
create trigger mission_runs_updated_at before update on public.mission_runs
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Automatic checks on the linked case. Evaluated with definer rights but only
-- after verifying that the caller can read the case.
-- -----------------------------------------------------------------------------
create function public.mission_check(p_case uuid, p_check jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_type text := p_check ->> 'type';
  v_min integer := coalesce((p_check ->> 'min')::int, 1);
  v_n integer := 0;
  v_ok boolean := false;
  v_msg text;
begin
  if v_type is null or v_type = 'none' then
    return jsonb_build_object('ok', true);
  end if;
  if p_case is null then
    return jsonb_build_object('ok', false, 'message', 'Collega prima il caso su cui stai lavorando (passo 1).');
  end if;

  case v_type
    when 'case' then
      select count(*) into v_n from public.cases
       where id = p_case
         and (p_check ->> 'category' is null or category::text = p_check ->> 'category');
      v_msg := 'Il caso collegato non è della tipologia richiesta (' || coalesce(p_check ->> 'category', '-') || ').';
    when 'objective' then
      select count(*) into v_n from public.cases where id = p_case and char_length(btrim(coalesce(objective, ''))) >= v_min;
      v_msg := 'Scrivi l''obiettivo investigativo nel caso (almeno ' || v_min || ' caratteri): una domanda a cui il caso deve rispondere.';
      v_min := 1;
    when 'tasks' then
      select count(*) into v_n from public.case_tasks where case_id = p_case;
      v_msg := 'Servono almeno ' || v_min || ' attività nel caso.';
    when 'evidence' then
      select count(*) into v_n from public.evidence
       where case_id = p_case and (coalesce((p_check ->> 'with_file')::boolean, false) = false or sha256_hash is not null);
      v_msg := 'Servono almeno ' || v_min || ' evidenze collegate al caso' ||
               case when coalesce((p_check ->> 'with_file')::boolean, false) then ' con file caricato (hash calcolato).' else '.' end;
    when 'phishing' then
      select count(*) into v_n from public.phishing_analyses
       where case_id = p_case and (coalesce((p_check ->> 'with_verdict')::boolean, false) = false or verdict <> 'undetermined');
      v_msg := 'Salva un''analisi nel Phishing Lab collegata al caso' ||
               case when coalesce((p_check ->> 'with_verdict')::boolean, false) then ', con un verdetto.' else '.' end;
    when 'domain' then
      select count(*) into v_n from public.domain_analyses where case_id = p_case and risk_level is not null;
      v_msg := 'Salva un''analisi di dominio collegata al caso, con livello di rischio motivato.';
    when 'ioc' then
      select count(*) into v_n from public.ioc_indicators where case_id = p_case;
      v_msg := 'Registra almeno ' || v_min || ' indicatori (IOC) collegati al caso.';
    when 'finding' then
      select count(*) into v_n from public.osint_findings
       where case_id = p_case
         and (p_check -> 'statuses' is null or info_status::text in (select jsonb_array_elements_text(p_check -> 'statuses')));
      v_msg := 'Registra almeno ' || v_min || ' risultati nell''OSINT Workspace collegati al caso' ||
               case when p_check -> 'statuses' is not null then ' con lo stato dell''informazione richiesto.' else '.' end;
    when 'sources' then
      select count(distinct source_name) into v_n from public.osint_findings where case_id = p_case;
      v_msg := 'Servono risultati OSINT da almeno ' || v_min || ' fonti diverse.';
    when 'timeline' then
      select count(*) into v_n from public.investigation_events where case_id = p_case;
      v_msg := 'Aggiungi almeno ' || v_min || ' eventi alla timeline del caso.';
    when 'attack' then
      select count(*) into v_n from public.case_attack_techniques
       where case_id = p_case
         and (p_check -> 'any_of' is null or technique_id in (select jsonb_array_elements_text(p_check -> 'any_of'))
              or split_part(technique_id, '.', 1) in (select jsonb_array_elements_text(p_check -> 'any_of')));
      v_msg := 'Mappa sul caso almeno ' || v_min || ' tecnica/he MITRE ATT&CK pertinente/i' ||
               case when p_check -> 'any_of' is not null then ' (suggerimento: tra ' || (select string_agg(x, ', ') from jsonb_array_elements_text(p_check -> 'any_of') x) || ').' else '.' end;
    when 'report' then
      select count(*) into v_n from public.reports
       where case_id = p_case
         and (p_check ->> 'status' is null or status::text = p_check ->> 'status')
         and (p_check ->> 'report_type' is null or report_type::text = p_check ->> 'report_type');
      v_msg := 'Crea il report del caso' ||
               case when p_check ->> 'status' = 'final' then ' e finalizzalo.' else '.' end;
    when 'risk_set' then
      select count(*) into v_n from public.cases where id = p_case and risk_level <> 'informational';
      v_msg := 'Aggiorna il livello di rischio del caso con la tua valutazione.';
    when 'closed' then
      select count(*) into v_n from public.cases where id = p_case and status in ('closed', 'archived');
      v_msg := 'Chiudi il caso.';
    else
      return jsonb_build_object('ok', false, 'message', 'Verifica non riconosciuta.');
  end case;

  v_ok := v_n >= v_min;
  return jsonb_build_object('ok', v_ok, 'found', v_n, 'message', case when v_ok then null else v_msg end);
end;
$$;
revoke execute on function public.mission_check(uuid, jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------
create function public.start_mission(p_mission uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.missions where id = p_mission and is_published) then
    raise exception 'mission not found' using errcode = 'P0002';
  end if;
  select id into v_id from public.mission_runs
   where user_id = (select auth.uid()) and mission_id = p_mission and status = 'in_progress';
  if v_id is null then
    insert into public.mission_runs (mission_id, user_id) values (p_mission, (select auth.uid())) returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function public.link_mission_case(p_run uuid, p_case uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.mission_runs where id = p_run and user_id = (select auth.uid()) and status = 'in_progress') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not public.can_write_case(p_case) then
    raise exception 'case not writable' using errcode = '42501';
  end if;
  update public.mission_runs set case_id = p_case where id = p_run;
end;
$$;

-- Verifies one step: automatic check + checkpoint answer. Returns the outcome
-- and, only when the step is passed, the explanation and the senior's note.
create function public.check_mission_step(p_run uuid, p_step text, p_answer jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_run public.mission_runs;
  v_step jsonb;
  v_key jsonb;
  v_check jsonb;
  v_state jsonb;
  v_quiz jsonb;
  v_correct boolean;
  v_answered jsonb;
begin
  select * into v_run from public.mission_runs where id = p_run for update;
  if v_run.id is null or v_run.user_id <> (select auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_run.status <> 'in_progress' then
    raise exception 'mission already completed' using errcode = '23514';
  end if;
  if v_run.case_id is not null and not public.can_read_case(v_run.case_id) then
    raise exception 'case not accessible' using errcode = '42501';
  end if;

  select s into v_step
    from public.missions m, jsonb_array_elements(m.content -> 'steps') s
   where m.id = v_run.mission_id and s ->> 'id' = p_step;
  if v_step is null then
    raise exception 'unknown step' using errcode = 'P0002';
  end if;
  select steps -> p_step into v_key from public.mission_keys where mission_id = v_run.mission_id;

  v_check := public.mission_check(v_run.case_id, coalesce(v_step -> 'check', '{"type":"none"}'::jsonb));
  if not (v_check ->> 'ok')::boolean then
    return jsonb_build_object('passed', false, 'message', v_check ->> 'message');
  end if;

  v_quiz := v_step -> 'quiz';
  v_state := coalesce(v_run.steps -> p_step, '{}'::jsonb);
  if v_quiz is not null and v_quiz ->> 'type' in ('single', 'multi') then
    if p_answer is null or p_answer = 'null'::jsonb or (jsonb_typeof(p_answer) = 'array' and jsonb_array_length(p_answer) = 0) then
      return jsonb_build_object('passed', false, 'message', 'Rispondi alla domanda di verifica del passo.');
    end if;
    if v_quiz ->> 'type' = 'single' then
      v_correct := p_answer = v_key -> 'correct';
    else
      v_correct := (select coalesce(array_agg(x order by x), '{}') from jsonb_array_elements_text(p_answer) x)
                 = (select coalesce(array_agg(x order by x), '{}') from jsonb_array_elements_text(v_key -> 'correct') x);
    end if;
  elsif v_quiz is not null and v_quiz ->> 'type' = 'text' then
    if char_length(btrim(coalesce(p_answer #>> '{}', ''))) < coalesce((v_quiz ->> 'min_length')::int, 30) then
      return jsonb_build_object('passed', false, 'message',
        'Scrivi una risposta di almeno ' || coalesce((v_quiz ->> 'min_length')::int, 30) || ' caratteri.');
    end if;
    v_correct := null;
  end if;

  -- First answer is the one that counts for the score; later attempts are kept for review.
  v_answered := jsonb_build_object(
    'done', true,
    'answer', coalesce(v_state -> 'answer', p_answer),
    'correct', coalesce(v_state -> 'correct', to_jsonb(v_correct)),
    'attempts', coalesce((v_state ->> 'attempts')::int, 0) + 1,
    'completed_at', coalesce(v_state ->> 'completed_at', now()::text)
  );
  update public.mission_runs set steps = steps || jsonb_build_object(p_step, v_answered) where id = p_run;

  return jsonb_build_object(
    'passed', true,
    'correct', v_correct,
    'correct_answer', case when v_quiz ->> 'type' in ('single', 'multi') then v_key -> 'correct' end,
    'explanation', v_key ->> 'explanation',
    'senior', v_key ->> 'senior'
  );
end;
$$;

-- Notes of the steps already passed (to show them again when the page reloads).
create function public.get_mission_notes(p_run uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_run public.mission_runs;
begin
  select * into v_run from public.mission_runs where id = p_run;
  if v_run.id is null or v_run.user_id <> (select auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(k.key, k.value - 'correct' || jsonb_build_object('correct_answer', k.value -> 'correct'))
    from public.mission_keys mk, jsonb_each(mk.steps) k
    where mk.mission_id = v_run.mission_id and v_run.steps ? k.key
  ), '{}'::jsonb);
end;
$$;

-- Completes the run once every step is done and releases the debrief.
create function public.complete_mission(p_run uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_run public.mission_runs;
  v_total integer;
  v_done integer;
begin
  select * into v_run from public.mission_runs where id = p_run for update;
  if v_run.id is null or v_run.user_id <> (select auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select jsonb_array_length(content -> 'steps') into v_total from public.missions where id = v_run.mission_id;
  select count(*) into v_done from jsonb_each(v_run.steps) s where (s.value ->> 'done')::boolean;
  if v_done < v_total then
    raise exception 'complete every step first' using errcode = '23514';
  end if;
  if v_run.status = 'in_progress' then
    update public.mission_runs set status = 'completed', completed_at = now() where id = p_run;
  end if;
  return (select debrief from public.mission_keys where mission_id = v_run.mission_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges & RLS
-- -----------------------------------------------------------------------------
alter table public.missions enable row level security;
alter table public.mission_keys enable row level security;
alter table public.mission_runs enable row level security;

revoke all on public.missions, public.mission_keys, public.mission_runs from anon, authenticated;
grant select on public.missions to authenticated;
grant select, delete on public.mission_runs to authenticated;
comment on table public.mission_keys is
  'Mission answer keys, senior notes and debriefs. No API access by design; read via check_mission_step / complete_mission.';

create policy missions_read on public.missions for select to authenticated using (is_published);
create policy mission_runs_own on public.mission_runs for select to authenticated using (user_id = (select auth.uid()));
create policy mission_runs_delete_open on public.mission_runs for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'in_progress');

revoke execute on function public.start_mission(uuid) from public, anon;
revoke execute on function public.link_mission_case(uuid, uuid) from public, anon;
revoke execute on function public.check_mission_step(uuid, text, jsonb) from public, anon;
revoke execute on function public.get_mission_notes(uuid) from public, anon;
revoke execute on function public.complete_mission(uuid) from public, anon;
grant execute on function public.start_mission(uuid) to authenticated;
grant execute on function public.link_mission_case(uuid, uuid) to authenticated;
grant execute on function public.check_mission_step(uuid, text, jsonb) to authenticated;
grant execute on function public.get_mission_notes(uuid) to authenticated;
grant execute on function public.complete_mission(uuid) to authenticated;
