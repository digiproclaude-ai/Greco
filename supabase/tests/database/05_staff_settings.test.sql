-- Staff powers need MFA; platform settings, audit log and outbox are protected.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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
insert into ids values
  ('s', pg_temp.new_user('staff@test.local', '{"full_name": "Sasha Staff"}')),
  ('r', pg_temp.new_user('regular@test.local', '{"full_name": "Ravi Regular"}'));
insert into public.staff_roles (user_id, role) values ((select id from ids where name = 's'), 'admin');

select is((select count(*)::int from app_private.audit_logs where action = 'staff.role_granted' and target_id = (select id::text from ids where name = 's')), 1, 'granting a staff role is audited');

select pg_temp.login((select id from ids where name = 's'), 'aal1');
select is(app.is_staff(), false, 'staff powers are off without MFA');
select is((select count(*)::int from public.profiles), 1, 'without MFA a staff member only sees their own profile');
select is((select count(*)::int from public.staff_roles), 1, 'staff can always see their own staff roles');

select pg_temp.login((select id from ids where name = 's'), 'aal2');
select is(app.is_staff(), true, 'staff powers are on with MFA');
select ok((select count(*) from public.profiles) >= 2, 'with MFA a staff member can see other profiles');
select is((select count(*)::int from public.platform_settings where key = 'payments.live_enabled'), 1, 'staff can read private settings');

select pg_temp.login((select id from ids where name = 'r'));
select is((select count(*)::int from public.staff_roles), 0, 'regular users cannot see staff roles');
select is((select count(*)::int from public.platform_settings where key = 'payments.live_enabled'), 0, 'regular users cannot read private settings');
select throws_ok($$ update public.platform_settings set value = 'true' where key = 'signups.enabled' $$, '42501', null, 'users cannot change platform settings');
select throws_ok($$ select public.outbox_claim(10) $$, '42501', null, 'users cannot read the outbox');
select throws_ok($$ select count(*) from app_private.audit_logs $$, '42501', null, 'users cannot read the audit log');

select pg_temp.as_anon();
select is((select count(*)::int from public.platform_settings where key = 'signups.enabled'), 1, 'public settings are readable by visitors');

select pg_temp.as_service();
select ok((select count(*) from public.outbox_claim(100)) >= 2, 'the service role can claim outbox events');

select pg_temp.as_owner();
update public.platform_settings set value = 'false' where key = 'signups.enabled';
select is((select count(*)::int from app_private.platform_settings_history where key = 'signups.enabled' and new_value = 'false'::jsonb), 1, 'setting changes are kept in history');
select throws_ok($$ delete from app_private.audit_logs $$, '42501', null, 'the audit log is append-only');

select * from finish();
rollback;
