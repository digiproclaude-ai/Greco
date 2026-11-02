-- Let owners discard their public images once nothing uses them. The app then deletes the
-- stored object through the Storage API (storage policy: own folder only).
create function public.discard_uploaded_file(p_file_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  select path into v_path
    from public.file_objects
   where id = p_file_id and owner_user_id = auth.uid() and bucket = 'public-media' and deleted_at is null
   for update;
  if v_path is null then
    raise exception 'file not found' using errcode = '42501';
  end if;
  if exists (select 1 from public.providers where avatar_file_id = p_file_id or cover_file_id = p_file_id)
     or exists (select 1 from public.profiles where avatar_file_id = p_file_id)
     or exists (select 1 from public.service_media where file_id = p_file_id)
     or exists (select 1 from public.portfolio_item_media where file_id = p_file_id) then
    raise exception 'file is still in use' using errcode = '55000';
  end if;
  update public.file_objects set deleted_at = now() where id = p_file_id;
  return v_path;
end;
$$;

revoke all on function public.discard_uploaded_file(uuid) from public, anon, authenticated;
grant execute on function public.discard_uploaded_file(uuid) to authenticated;
