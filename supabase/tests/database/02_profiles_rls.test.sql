-- Profiles are private to their owner; protected columns cannot be changed by users.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

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
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end;
$$;
create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create temp table ids (name text primary key, id uuid not null);
grant select on ids to public;
insert into ids values
  ('a', pg_temp.new_user('a@test.local', '{"full_name": "Alice A", "initial_role": "client", "legal_accepted": "true"}')),
  ('b', pg_temp.new_user('b@test.local', '{"full_name": "Bob B", "initial_role": "client"}'));

select pg_temp.login((select id from ids where name = 'a'));

select is((select count(*)::int from public.profiles where id = (select id from ids where name = 'a')), 1, 'users can read their own profile');
select is((select count(*)::int from public.profiles where id = (select id from ids where name = 'b')), 0, 'users cannot read other profiles');
select lives_ok($$ update public.profiles set full_name = 'Alice Anders' where id = (select id from ids where name = 'a') $$, 'users can update allowed columns');
select is((select full_name from public.profiles where id = (select id from ids where name = 'a')), 'Alice Anders', 'the update is applied');
select throws_ok($$ update public.profiles set active_role = 'expert' where id = (select id from ids where name = 'a') $$, '42501', null, 'active_role can only change through switch_active_role');
select throws_ok($$ update public.profiles set account_status = 'active' where id = (select id from ids where name = 'a') $$, '42501', null, 'account_status is not writable by users');
select throws_ok($$ update public.profiles set country_code = 'KP' where id = (select id from ids where name = 'a') $$, '23514', null, 'blocked countries cannot be selected');
select lives_ok($$ update public.profiles set full_name = 'Hacked' where id = (select id from ids where name = 'b') $$, 'updating another profile does not error...');
select throws_ok($$ insert into public.profiles (id, full_name, active_role) values (gen_random_uuid(), 'Fake', 'client') $$, '42501', null, 'users cannot create profiles directly');
select is((select count(*)::int from public.user_roles where user_id = (select id from ids where name = 'b')), 0, 'users cannot see other users'' roles');

select is(public.has_accepted_current_legal(), true, 'a user who accepted at signup has accepted the current documents');
select pg_temp.login((select id from ids where name = 'b'));
select is(public.has_accepted_current_legal(), false, 'a user without acceptance must accept');
select is(public.accept_current_legal_documents(), 2, 'accepting records both current documents');

select pg_temp.as_owner();
select is((select full_name from public.profiles where id = (select id from ids where name = 'b')), 'Bob B', '...but changes nothing');

select pg_temp.as_anon();
select throws_ok($$ select count(*) from public.profiles $$, '42501', null, 'anon cannot read profiles at all');

select * from finish();
rollback;
