-- Conversations, the contact policy, blocks, reports, notifications and realtime channel access.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

create function pg_temp.new_user(p_email text, p_meta jsonb) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, aud, role)
  values (v_id, p_email, p_meta, now(), 'authenticated', 'authenticated');
  return v_id;
end;
$$;
create function pg_temp.login(p_user uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
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
  ('c', pg_temp.new_user('client-m@test.local', '{"full_name": "Carla Client", "initial_role": "client"}')),
  ('o', pg_temp.new_user('other-m@test.local', '{"full_name": "Olga Outsider", "initial_role": "client"}')),
  ('e', pg_temp.new_user('expert-m@test.local', '{"full_name": "Erik Expert", "initial_role": "expert"}')),
  ('e2', pg_temp.new_user('expert2-m@test.local', '{"full_name": "Edda Expert", "initial_role": "expert"}')),
  ('mod', pg_temp.new_user('mod-m@test.local', '{"full_name": "Mara Moderator", "initial_role": "client"}'));
insert into ids select 'p', id from public.providers where owner_user_id = (select id from ids where name = 'e');
insert into ids select 'p2', id from public.providers where owner_user_id = (select id from ids where name = 'e2');
update public.providers set status = 'active', published_at = now() where id in (select id from ids where name in ('p', 'p2'));
insert into public.staff_roles (user_id, role) values ((select id from ids where name = 'mod'), 'moderator');

-- Opening conversations ---------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'c'));
insert into ids select 'conv', public.conversations_open(p_provider_id => (select id from ids where name = 'p'));
select isnt((select id from ids where name = 'conv'), null, 'clients open a conversation with a live expert');
select is(public.conversations_open(p_provider_id => (select id from ids where name = 'p')), (select id from ids where name = 'conv'),
  'the same pair reuses its conversation');
select is((select count(*)::int from public.conversation_participants where conversation_id = (select id from ids where name = 'conv')), 2,
  'both people take part');

select pg_temp.login((select id from ids where name = 'e2'));
select throws_ok($$ select public.conversations_open(p_client_user_id => (select id from ids where name = 'c')) $$, '42501', null,
  'experts cannot cold-message clients');

-- Sending and the contact policy ------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'c'));
create temp table sent as select public.messages_send((select id from ids where name = 'conv'), 'Hi! Write me at carla@example.com please.') as r;
grant select on sent to public;
select is((select (r ->> 'masked')::boolean from sent), true, 'email addresses are masked before an order exists');
select is((select body from public.messages where id = (select (r ->> 'id')::uuid from sent)),
  'Hi! Write me at [[contact-hidden]] please.', 'the stored text no longer contains the address');
select ok((select 'contact_email' = any (contact_flags) from public.messages where id = (select (r ->> 'id')::uuid from sent)),
  'the signal is recorded on the message');
select is((select moderation_state from public.messages where id = (select (r ->> 'id')::uuid from sent)), 'masked', 'and its state');

select lives_ok($$ select public.messages_send((select id from ids where name = 'conv'), 'Do you also work with Vapi?') $$,
  'ordinary messages go through');
select throws_ok($$ select public.messages_send((select id from ids where name = 'conv'), '   ') $$, '22023', null, 'empty messages are refused');

-- Reading and unread counts ---------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'e'));
select is((select count(*)::int from public.messages where conversation_id = (select id from ids where name = 'conv')), 2, 'the expert reads the messages');
select is((public.my_counts() ->> 'messages')::int, 1, 'one conversation is unread');
select is((select count from public.notifications where user_id = (select id from ids where name = 'e') and type_key = 'message.received'), 2,
  'message notifications are grouped per conversation');
select lives_ok($$ select public.conversations_mark_read((select id from ids where name = 'conv')) $$, 'reading marks the conversation read');
select is((public.my_counts() ->> 'messages')::int, 0, 'nothing is unread any more');
select is((select count(*)::int from public.notifications where user_id = (select id from ids where name = 'e') and read_at is null
            and type_key = 'message.received'), 0, 'and the message notification is cleared');

select pg_temp.login((select id from ids where name = 'o'));
select is((select count(*)::int from public.messages where conversation_id = (select id from ids where name = 'conv')), 0,
  'outsiders cannot read the messages');
select is((select count(*)::int from public.conversations where id = (select id from ids where name = 'conv')), 0, 'or the conversation');
select throws_ok($$ select public.messages_send((select id from ids where name = 'conv'), 'Let me in') $$, '42501', null,
  'outsiders cannot post');

-- Realtime channel access --------------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'c'));
select ok(app.can_access_topic('conversation:' || (select id from ids where name = 'conv')), 'participants may join the conversation channel');
select ok(app.can_access_topic('user:' || (select id from ids where name = 'c')), 'users may join their own channel');
select pg_temp.login((select id from ids where name = 'o'));
select ok(not app.can_access_topic('conversation:' || (select id from ids where name = 'conv')), 'others may not join the conversation channel');
select ok(not app.can_access_topic('user:' || (select id from ids where name = 'c')), 'or another user''s channel');

-- Repeated contact attempts are flagged -------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'c'));
select public.messages_send((select id from ids where name = 'conv'), 'Call me on +40 721 555 019');
select public.messages_send((select id from ids where name = 'conv'), 'Or on WhatsApp: +40 721 555 019');
select pg_temp.as_owner();
select is((select count(*)::int from public.content_reports where target_type = 'user' and target_id = (select id from ids where name = 'c')
            and source = 'system' and status = 'open'), 1, 'a third attempt in a week is flagged for moderators');

-- Reports -----------------------------------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'o'));
select throws_ok($$ select public.reports_create('message', (select (r ->> 'id')::uuid from sent), 'off_platform') $$, '42501', null,
  'only participants can report a message');
select pg_temp.login((select id from ids where name = 'e'));
insert into ids select 'report', public.reports_create('message', (select (r ->> 'id')::uuid from sent), 'off_platform', 'Asked to email outside Greco.');
select isnt((select id from ids where name = 'report'), null, 'participants report messages');
select throws_ok($$ select public.reports_create('message', (select (r ->> 'id')::uuid from sent), 'spam') $$, '23505', null,
  'one open report per person and target');

-- Moderation of a reported message ------------------------------------------------------------------------------------
select throws_ok($$ select * from public.admin_reported_message((select id from ids where name = 'report')) $$, '42501', null,
  'only staff read reported conversations');
select pg_temp.login((select id from ids where name = 'mod'), 'aal2');
select ok((select count(*) >= 1 from public.admin_reported_message((select id from ids where name = 'report'))), 'staff read the reported conversation');
select lives_ok($$ select public.admin_moderate_message((select (r ->> 'id')::uuid from sent), 'remove', 'Sharing contact details is not allowed.',
                   (select id from ids where name = 'report')) $$, 'moderators remove messages with reasons');
select pg_temp.as_owner();
select is((select body from public.messages where id = (select (r ->> 'id')::uuid from sent)), null, 'removed text is no longer readable');
select is((select count(*)::int from app_private.audit_logs where action = 'conversation.viewed_by_staff'), 1, 'staff views are audited');

-- Blocks ------------------------------------------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'e'));
insert into public.user_blocks (blocker_user_id, blocked_user_id) values ((select id from ids where name = 'e'), (select id from ids where name = 'c'));
select pg_temp.login((select id from ids where name = 'c'));
select throws_ok($$ select public.messages_send((select id from ids where name = 'conv'), 'Hello again') $$, '42501', null,
  'blocked people cannot send messages');

select * from finish();
rollback;
