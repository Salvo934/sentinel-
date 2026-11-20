-- =============================================================================
-- Sentinel Intelligence — 005 Supabase Storage
--
-- Buckets (all private; files are served only through short-lived signed URLs):
--   investigation-evidence  {organization_id}/{case_id}/{uuid}-{filename}
--   investigation-reports   {organization_id}/{case_id}/{report_id}-v{n}.pdf
--   training-datasets       {scenario_slug}/{filename}      (read: everyone signed in)
--   user-exports            {user_id}/{filename}            (owner only)
--
-- Retention strategy (documented, enforced by process, not by cron yet):
--   evidence/reports follow the case lifecycle and are removed only together
--   with an archived case by an organization admin; user-exports are
--   personal and can be deleted by their owner at any time.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('investigation-evidence', 'investigation-evidence', false, 20971520, array[
     'application/pdf', 'text/plain', 'text/csv', 'application/json', 'message/rfc822',
     'image/png', 'image/jpeg', 'image/webp',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
   ]),
  ('investigation-reports', 'investigation-reports', false, 15728640, array['application/pdf']),
  ('training-datasets', 'training-datasets', false, 10485760, array[
     'application/pdf', 'text/plain', 'text/csv', 'application/json', 'message/rfc822', 'image/png', 'image/jpeg'
   ]),
  ('user-exports', 'user-exports', false, 26214400, array['application/pdf', 'application/json', 'text/csv', 'application/zip'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Safe path parsing: returns the case id encoded in "{org}/{case}/..." when
-- the folder structure is valid and the case really belongs to that org.
create function public.storage_case_from_path(p_name text)
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
  v_uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_case uuid;
begin
  if array_length(v_parts, 1) <> 3 or v_parts[1] !~ v_uuid_re or v_parts[2] !~ v_uuid_re
     or v_parts[3] = '' or v_parts[3] like '.%' then
    return null;
  end if;
  select id into v_case from public.cases
   where id = v_parts[2]::uuid and organization_id = v_parts[1]::uuid;
  return v_case;
end;
$$;
revoke execute on function public.storage_case_from_path(text) from public, anon;
grant execute on function public.storage_case_from_path(text) to authenticated;

-- investigation-evidence -------------------------------------------------------
create policy "evidence files: read" on storage.objects for select to authenticated
  using (bucket_id = 'investigation-evidence'
         and public.can_read_case(public.storage_case_from_path(name)));
create policy "evidence files: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'investigation-evidence'
              and public.can_write_case(public.storage_case_from_path(name)));
create policy "evidence files: delete (admin)" on storage.objects for delete to authenticated
  using (bucket_id = 'investigation-evidence'
         and public.case_role_in(public.storage_case_from_path(name), array['admin']::public.org_role[]));
-- No update policy: evidence files are write-once (overwriting would break the hash).

-- investigation-reports --------------------------------------------------------
create policy "report files: read" on storage.objects for select to authenticated
  using (bucket_id = 'investigation-reports'
         and public.can_read_case(public.storage_case_from_path(name)));
create policy "report files: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'investigation-reports'
              and public.can_write_case(public.storage_case_from_path(name)));
create policy "report files: delete (admin)" on storage.objects for delete to authenticated
  using (bucket_id = 'investigation-reports'
         and public.case_role_in(public.storage_case_from_path(name), array['admin']::public.org_role[]));

-- training-datasets ------------------------------------------------------------
create policy "training datasets: read" on storage.objects for select to authenticated
  using (bucket_id = 'training-datasets');
create policy "training datasets: upload (platform admin)" on storage.objects for insert to authenticated
  with check (bucket_id = 'training-datasets' and public.is_platform_admin());
create policy "training datasets: update (platform admin)" on storage.objects for update to authenticated
  using (bucket_id = 'training-datasets' and public.is_platform_admin());
create policy "training datasets: delete (platform admin)" on storage.objects for delete to authenticated
  using (bucket_id = 'training-datasets' and public.is_platform_admin());

-- user-exports -----------------------------------------------------------------
create policy "user exports: read own" on storage.objects for select to authenticated
  using (bucket_id = 'user-exports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user exports: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-exports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user exports: update own" on storage.objects for update to authenticated
  using (bucket_id = 'user-exports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user exports: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'user-exports' and (storage.foldername(name))[1] = (select auth.uid())::text);
