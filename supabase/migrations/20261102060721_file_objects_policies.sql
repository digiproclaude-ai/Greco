-- One read policy per role on file_objects (performance advisor: multiple permissive policies).
-- Signed-in users see their own files, public media, and (staff) everything; anonymous visitors
-- see public media only, through the column grant from the catalog migration.
drop policy file_objects_read on public.file_objects;
drop policy file_objects_read_public_media on public.file_objects;

create policy file_objects_read on public.file_objects for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (bucket = 'public-media' and deleted_at is null)
    or (select app.is_staff())
  );
create policy file_objects_read_public_media on public.file_objects for select to anon
  using (bucket = 'public-media' and deleted_at is null);
