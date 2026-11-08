-- Conversation list, private file discard and the service-role job functions.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

create function pg_temp.new_user(p_email text, p_meta jsonb) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, aud, role)
  values (v_id, p_email, p_meta, now(), 'authenticated', 'authenticated');
  return v_id;
end;
$$;
create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal1')::text, true);
end;
$$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
end;
$$;
create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to public;
insert into ids values
  ('c', pg_temp.new_user('client-s@test.local', '{"full_name": "Carla Client", "initial_role": "client"}')),
  ('e', pg_temp.new_user('expert-s@test.local', '{"full_name": "Erik Expert", "initial_role": "expert"}'));
insert into ids select 'p', id from public.providers where owner_user_id = (select id from ids where name = 'e');
update public.providers set status = 'active', published_at = now(), display_name = 'Erik AI Studio'
 where id = (select id from ids where name = 'p');

-- Conversation list -----------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'c'));
insert into ids select 'conv', public.conversations_open(p_provider_id => (select id from ids where name = 'p'));
select lives_ok($$ select public.messages_send((select id from ids where name = 'conv'), 'Hello Erik') $$, 'the client writes');
select is((select counterpart_name from public.my_conversations()), 'Erik AI Studio', 'clients see the expert''s public name');
select is((select my_role from public.my_conversations()), 'client', 'and their own side');
select is((select unread_count::int from public.my_conversations()), 0, 'own messages are not unread');
select is((select last_sender_is_me from public.my_conversations()), true, 'the last message is theirs');

select pg_temp.login((select id from ids where name = 'e'));
select is((select counterpart_name from public.my_conversations()), 'Carla', 'experts see the client''s first name only');
select is((select unread_count::int from public.my_conversations()), 1, 'one unread message');
select is((select can_reply from public.my_conversations()), true, 'replies are allowed');
select is((select count(*)::int from public.my_conversations(p_archived => true)), 0, 'nothing archived');

select pg_temp.login((select id from ids where name = 'c'));
insert into public.user_blocks (blocker_user_id, blocked_user_id)
values ((select id from ids where name = 'c'), (select id from ids where name = 'e'));
select is((select blocked_by_me from public.my_conversations()), true, 'blocking shows in the list');
select is((select can_reply from public.my_conversations()), false, 'and stops replies');

-- Private files ----------------------------------------------------------------------------------------
select pg_temp.as_owner();
insert into storage.objects (bucket_id, name, owner) values
  ('attachments', (select id from ids where name = 'c')::text || '/project_attachment/f1', (select id from ids where name = 'c'));
select pg_temp.login((select id from ids where name = 'c'));
insert into ids select 'file', public.register_private_file(
  (select id from ids where name = 'c')::text || '/project_attachment/f1', 'project_attachment', 'application/pdf', 1000, null, 'brief.pdf');
select is(public.discard_uploaded_file((select id from ids where name = 'file')),
  (select id from ids where name = 'c')::text || '/project_attachment/f1', 'owners discard unused private files');

select pg_temp.login((select id from ids where name = 'e'));
select throws_ok($$ select public.discard_uploaded_file((select id from ids where name = 'file')) $$, '42501', null,
  'other people cannot discard them');

-- Job functions -------------------------------------------------------------------------------------------
select throws_ok($$ select public.file_record_scan((select id from ids where name = 'file'), 'clean') $$, '42501', null,
  'signed-in users cannot record scan results');

select pg_temp.as_service();
select lives_ok($$ select public.file_record_scan((select id from ids where name = 'file'), 'infected', 'EICAR') $$,
  'the service role records a verdict');
select is((select scan_status::text from public.file_objects where id = (select id from ids where name = 'file')), 'infected',
  'the verdict is stored');

select is((select count(*)::int from public.unread_digest_candidates(0)), 1, 'the expert is due an unread digest');
select lives_ok($$ select public.unread_digest_mark_sent((select id from ids where name = 'e')) $$, 'marking the digest sent');
select is((select count(*)::int from public.unread_digest_candidates(0)), 0, 'and they are not due again straight away');

select pg_temp.as_owner();
insert into public.saved_searches (id, user_id, kind, name, query, alerts_enabled)
values (gen_random_uuid(), (select id from ids where name = 'c'), 'services', 'Voice agents', '{"q": "voice"}', true);
select pg_temp.as_service();
select public.saved_search_record_alert((select id from public.saved_searches where name = 'Voice agents'), 3);
select is((select (params ->> 'count')::int from public.notifications
            where user_id = (select id from ids where name = 'c') and type_key = 'saved_search.match'), 3,
  'saved-search alerts notify the owner');

select * from finish();
rollback;
