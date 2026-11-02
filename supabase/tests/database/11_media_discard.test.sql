-- Discarding uploaded public images.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, aud, role) values
  ('00000000-0000-4000-8000-00000000b101', 'owner-media@test.local', '{"full_name": "Mia Media", "initial_role": "expert"}', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000b102', 'other-media@test.local', '{"full_name": "Otto Other", "initial_role": "client"}', now(), 'authenticated', 'authenticated');

insert into public.file_objects (id, bucket, path, owner_user_id, purpose, mime_type, size_bytes, scan_status) values
  ('00000000-0000-4000-8000-00000000f101', 'public-media', '00000000-0000-4000-8000-00000000b101/avatar/a.webp',
   '00000000-0000-4000-8000-00000000b101', 'avatar', 'image/webp', 100, 'skipped'),
  ('00000000-0000-4000-8000-00000000f102', 'public-media', '00000000-0000-4000-8000-00000000b101/avatar/b.webp',
   '00000000-0000-4000-8000-00000000b101', 'avatar', 'image/webp', 100, 'skipped');
update public.providers set avatar_file_id = '00000000-0000-4000-8000-00000000f102'
 where owner_user_id = '00000000-0000-4000-8000-00000000b101';

select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000b102", "role": "authenticated"}', true);
select throws_ok($$select public.discard_uploaded_file('00000000-0000-4000-8000-00000000f101')$$, '42501', null,
  'another user cannot discard the file');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000b101", "role": "authenticated"}', true);
select throws_ok($$select public.discard_uploaded_file('00000000-0000-4000-8000-00000000f102')$$, '55000', null,
  'a file still used as the avatar cannot be discarded');
select is(public.discard_uploaded_file('00000000-0000-4000-8000-00000000f101'),
  '00000000-0000-4000-8000-00000000b101/avatar/a.webp', 'the owner discards an unused file and gets its path');
select throws_ok($$select public.discard_uploaded_file('00000000-0000-4000-8000-00000000f101')$$, '42501', null,
  'a discarded file cannot be discarded again');

select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select is((select count(*)::int from public.file_objects where id = '00000000-0000-4000-8000-00000000f101'), 0,
  'discarded files are no longer public');

select * from finish();
rollback;
