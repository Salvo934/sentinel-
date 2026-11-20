-- =============================================================================
-- LOCAL TESTING ONLY — minimal subset of the pgTAP API used by supabase/tests.
-- On Supabase (`supabase test db`) the real pgTAP extension is used instead.
-- Implemented: plan, finish, ok, is, isnt, throws_ok(sql, code, msg, desc),
-- lives_ok, is_empty. Output is TAP, like pgTAP.
-- State lives in custom GUCs so it works after `set role authenticated`.
-- =============================================================================

create function extensions._tap_bump(p_ok boolean) returns integer language plpgsql as $$
declare n integer := coalesce(nullif(current_setting('pgtap_lite.run', true), ''), '0')::int + 1;
begin
  perform set_config('pgtap_lite.run', n::text, false);
  if not p_ok then
    perform set_config('pgtap_lite.failed',
      (coalesce(nullif(current_setting('pgtap_lite.failed', true), ''), '0')::int + 1)::text, false);
  end if;
  return n;
end $$;

create function extensions.plan(p_count integer) returns text language plpgsql as $$
begin
  perform set_config('pgtap_lite.planned', p_count::text, false);
  perform set_config('pgtap_lite.run', '0', false);
  perform set_config('pgtap_lite.failed', '0', false);
  return '1..' || p_count;
end $$;

create function extensions.ok(p_ok boolean, p_desc text default '') returns text language plpgsql as $$
declare n integer := extensions._tap_bump(coalesce(p_ok, false));
begin
  return case when coalesce(p_ok, false) then 'ok ' else 'not ok ' end || n || ' - ' || coalesce(p_desc, '');
end $$;

create function extensions.is(p_have anyelement, p_want anyelement, p_desc text default '') returns text language plpgsql as $$
declare res text := extensions.ok(p_have is not distinct from p_want, p_desc);
begin
  if p_have is distinct from p_want then
    res := res || E'\n#         have: ' || coalesce(p_have::text, 'NULL') || E'\n#         want: ' || coalesce(p_want::text, 'NULL');
  end if;
  return res;
end $$;

create function extensions.isnt(p_have anyelement, p_want anyelement, p_desc text default '') returns text language sql as $$
  select extensions.ok(p_have is distinct from p_want, p_desc);
$$;

create function extensions.throws_ok(p_sql text, p_errcode text, p_errmsg text, p_desc text) returns text language plpgsql as $$
begin
  execute p_sql;
  return extensions.ok(false, p_desc) || E'\n#      no exception raised';
exception when others then
  if (p_errcode is null or sqlstate = p_errcode) and (p_errmsg is null or sqlerrm = p_errmsg) then
    return extensions.ok(true, p_desc);
  end if;
  return extensions.ok(false, p_desc) || E'\n#      caught: ' || sqlstate || ': ' || sqlerrm
      || E'\n#    wanted: ' || coalesce(p_errcode, '*') || ': ' || coalesce(p_errmsg, '*');
end $$;

create function extensions.lives_ok(p_sql text, p_desc text default '') returns text language plpgsql as $$
begin
  execute p_sql;
  return extensions.ok(true, p_desc);
exception when others then
  return extensions.ok(false, p_desc) || E'\n#      died: ' || sqlstate || ': ' || sqlerrm;
end $$;

create function extensions.is_empty(p_sql text, p_desc text default '') returns text language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') as _q' into n;
  return extensions.is(n, 0::bigint, p_desc);
end $$;

create function extensions.finish() returns setof text language plpgsql as $$
declare
  planned integer := coalesce(nullif(current_setting('pgtap_lite.planned', true), ''), '0')::int;
  run     integer := coalesce(nullif(current_setting('pgtap_lite.run', true), ''), '0')::int;
  failed  integer := coalesce(nullif(current_setting('pgtap_lite.failed', true), ''), '0')::int;
begin
  if run <> planned then
    return next '# Looks like you planned ' || planned || ' tests but ran ' || run;
  end if;
  if failed > 0 then
    return next '# Looks like you failed ' || failed || ' test(s) of ' || run;
  end if;
end $$;

grant execute on all functions in schema extensions to anon, authenticated, service_role;
