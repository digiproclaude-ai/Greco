-- Notification preferences, grouping rules and saved searches.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, aud, role) values
  ('00000000-0000-4000-8000-00000000c101', 'notify-a@test.local', '{"full_name": "Nora Notify", "initial_role": "client"}', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000c102', 'notify-b@test.local', '{"full_name": "Nils Notify", "initial_role": "client"}', now(), 'authenticated', 'authenticated');

select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000c101", "role": "authenticated"}', true);
select throws_ok($$ insert into public.notification_preferences (user_id, type_key, channel, enabled)
                   values ('00000000-0000-4000-8000-00000000c101', 'moderation.decided', 'in_app', false) $$, '42501', null,
  'moderation notices cannot be turned off');
select lives_ok($$ insert into public.notification_preferences (user_id, type_key, channel, enabled)
                  values ('00000000-0000-4000-8000-00000000c101', 'proposal.received', 'in_app', false),
                         ('00000000-0000-4000-8000-00000000c101', 'proposal.received', 'email', true) $$,
  'optional notifications can be switched between channels');
select lives_ok($$ insert into public.saved_searches (user_id, kind, name, query, alerts_enabled)
                  values ('00000000-0000-4000-8000-00000000c101', 'services', 'Voice agents', '{"q": "voice agent"}', true) $$,
  'users save searches');

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000c102", "role": "authenticated"}', true);
select is(app_private.notify('00000000-0000-4000-8000-00000000c102', 'proposal.received', 'project', null), null,
  'nobody is notified about their own actions');
select isnt(app_private.notify('00000000-0000-4000-8000-00000000c101', 'proposal.received', 'project', null), null,
  'email-only users still get a record for delivery');
select isnt((select read_at from public.notifications where user_id = '00000000-0000-4000-8000-00000000c101'), null,
  'but it does not count as unread in the app');

select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000c102", "role": "authenticated"}', true);
select is((select count(*)::int from public.saved_searches), 0, 'saved searches are private');

select * from finish();
rollback;
