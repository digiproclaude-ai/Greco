-- Role switching and enabling the second role (ARCHITECTURE.md §8).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
end;
$$;

create temp table ids (name text primary key, id uuid not null);
grant select on ids to public;
insert into ids values ('c', pg_temp.new_user('carla@test.local', '{"full_name": "Carla C", "initial_role": "client"}'));

select pg_temp.login((select id from ids where name = 'c'));
select throws_ok($$ select public.switch_active_role('expert') $$, '42501', null, 'cannot switch to a role that is not enabled');
select lives_ok($$ select public.enable_marketplace_role('expert') $$, 'a client can add the expert role');
select is((select count(*)::int from public.user_roles where user_id = (select id from ids where name = 'c')), 2, 'both roles are now enabled');
select is((select status::text from public.providers where owner_user_id = (select id from ids where name = 'c')), 'draft', 'a draft provider profile is created');
select is(public.switch_active_role('expert')::text, 'expert', 'switching to an enabled role works');
select is((select active_role::text from public.profiles where id = (select id from ids where name = 'c')), 'expert', 'the active role is stored');
select lives_ok($$ select public.enable_marketplace_role('expert') $$, 'enabling an already enabled role is a no-op');

select pg_temp.as_owner();
select is((select count(*)::int from app_private.audit_logs where action = 'identity.role_enabled' and target_id = (select id::text from ids where name = 'c')), 1, 'enabling a role is audited once');
update public.user_roles set status = 'suspended', suspended_at = now(), suspension_reason = 'test'
 where user_id = (select id from ids where name = 'c') and role = 'expert';

select pg_temp.login((select id from ids where name = 'c'));
select throws_ok($$ select public.switch_active_role('expert') $$, '42501', null, 'cannot switch into a suspended role');
select throws_ok($$ select public.enable_marketplace_role('expert') $$, '42501', null, 'cannot re-enable a suspended role');

select pg_temp.as_anon();
select throws_ok($$ select public.switch_active_role('client') $$, '42501', null, 'anon cannot call role functions');

select * from finish();
rollback;
