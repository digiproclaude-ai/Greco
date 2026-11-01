-- The auth.users trigger creates the account shell from validated signup metadata.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create function pg_temp.new_user(p_email text, p_meta jsonb) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, aud, role)
  values (v_id, p_email, p_meta, now(), 'authenticated', 'authenticated');
  return v_id;
end;
$$;

create temp table ids (name text primary key, id uuid not null);
insert into ids values
  ('client', pg_temp.new_user('clara@test.local', '{"full_name": "Clara Client", "country_code": "ro", "initial_role": "client", "legal_accepted": "true"}')),
  ('expert', pg_temp.new_user('erik@test.local', '{"full_name": "Erik Expert", "country_code": "DE", "initial_role": "expert", "legal_accepted": "true"}')),
  ('sneaky', pg_temp.new_user('sneaky@test.local', '{"full_name": "Sam", "initial_role": "admin", "staff_role": "super_admin", "country_code": "KP"}')),
  ('noname', pg_temp.new_user('nadia.k@test.local', '{}'));

select results_eq(
  $$ select full_name, country_code::text, active_role::text from public.profiles where id = (select id from ids where name = 'client') $$,
  $$ values ('Clara Client', 'RO', 'client') $$,
  'client signup creates a profile with normalised country and client role'
);
select is((select count(*)::int from public.user_roles where user_id = (select id from ids where name = 'client') and role = 'client' and status = 'active'), 1, 'client role is enabled');
select is((select count(*)::int from public.client_profiles where user_id = (select id from ids where name = 'client')), 1, 'client profile shell exists');
select is((select count(*)::int from public.providers where owner_user_id = (select id from ids where name = 'client')), 0, 'client signup creates no provider');
select is((select count(*)::int from public.legal_acceptances where user_id = (select id from ids where name = 'client') and context = 'registration'), 2, 'terms and privacy acceptance recorded');
select is((select count(*)::int from app_private.outbox_events where topic = 'identity.user_registered' and aggregate_id = (select id from ids where name = 'client')), 1, 'registration event queued in the outbox');

select results_eq(
  $$ select status::text, display_name, handle::text like 'expert-%' from public.providers where owner_user_id = (select id from ids where name = 'expert') $$,
  $$ values ('draft', 'Erik Expert', true) $$,
  'expert signup creates a draft provider with a generated handle'
);
select is((select active_role::text from public.profiles where id = (select id from ids where name = 'expert')), 'expert', 'expert starts in the expert workspace');

select is((select active_role::text from public.profiles where id = (select id from ids where name = 'sneaky')), 'client', 'unknown roles fall back to client');
select is((select count(*)::int from public.staff_roles where user_id = (select id from ids where name = 'sneaky')), 0, 'signup metadata can never create staff roles');
select is((select country_code from public.profiles where id = (select id from ids where name = 'sneaky')), null, 'blocked countries are not stored');
select is((select full_name from public.profiles where id = (select id from ids where name = 'noname')), 'nadia.k', 'missing name falls back to the email local part');
select is((select count(*)::int from public.legal_acceptances where user_id = (select id from ids where name = 'noname')), 0, 'no acceptance is recorded without explicit consent');

select * from finish();
rollback;
