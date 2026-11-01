-- Provider (expert/agency) visibility and owner-only edits.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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
  ('e', pg_temp.new_user('eva@test.local', '{"full_name": "Eva Expert", "initial_role": "expert"}')),
  ('o', pg_temp.new_user('otto@test.local', '{"full_name": "Otto Other", "initial_role": "client"}'));
insert into ids select 'p', id from public.providers where owner_user_id = (select id from ids where name = 'e');
insert into public.taxonomy_terms (id, kind, slug, status) values
  ('00000000-0000-4000-8000-0000000000a1', 'technology', 'langchain', 'active'),
  ('00000000-0000-4000-8000-0000000000a2', 'technology', 'not-yet-approved', 'pending');

select pg_temp.login((select id from ids where name = 'o'));
select is((select count(*)::int from public.providers where id = (select id from ids where name = 'p')), 0, 'draft providers are hidden from other users');
select pg_temp.as_anon();
select is((select count(*)::int from public.providers where id = (select id from ids where name = 'p')), 0, 'draft providers are hidden from visitors');

select pg_temp.login((select id from ids where name = 'e'));
select is((select count(*)::int from public.providers where id = (select id from ids where name = 'p')), 1, 'owners see their draft provider');
select lives_ok($$ update public.providers set headline = 'Voice agents for clinics' where id = (select id from ids where name = 'p') $$, 'owners can edit profile text');
select throws_ok($$ update public.providers set status = 'active' where id = (select id from ids where name = 'p') $$, '42501', null, 'owners cannot publish themselves');
select throws_ok($$ update public.providers set handle = 'eva' where id = (select id from ids where name = 'p') $$, '42501', null, 'handles cannot be changed directly');
select lives_ok($$ insert into public.provider_links (provider_id, kind, url) values ((select id from ids where name = 'p'), 'github', 'https://github.com/eva') $$, 'owners can add links');
select throws_ok($$ insert into public.provider_links (provider_id, kind, url, verified_at) values ((select id from ids where name = 'p'), 'website', 'https://eva.example', now()) $$, '42501', null, 'owners cannot mark links as verified');
select throws_ok($$ insert into public.provider_terms (provider_id, term_id) values ((select id from ids where name = 'p'), '00000000-0000-4000-8000-0000000000a2') $$, '42501', null, 'pending taxonomy terms cannot be attached');
select lives_ok($$ insert into public.provider_terms (provider_id, term_id) values ((select id from ids where name = 'p'), '00000000-0000-4000-8000-0000000000a1') $$, 'active taxonomy terms can be attached');

select pg_temp.login((select id from ids where name = 'o'));
select throws_ok($$ insert into public.provider_links (provider_id, kind, url) values ((select id from ids where name = 'p'), 'website', 'https://evil.example') $$, '42501', null, 'other users cannot add links to a provider');

select pg_temp.as_owner();
update public.providers set status = 'active' where id = (select id from ids where name = 'p');
update public.provider_links set verified_at = now() where provider_id = (select id from ids where name = 'p');
select is((select count(*)::int from app_private.audit_logs where action = 'provider.status_changed' and target_id = (select id::text from ids where name = 'p')), 1, 'provider status changes are audited');

select pg_temp.as_anon();
select is((select count(*)::int from public.providers where id = (select id from ids where name = 'p')), 1, 'active providers are public');
select throws_ok($$ select owner_user_id from public.providers $$, '42501', null, 'visitors cannot see which account owns a provider');

select pg_temp.login((select id from ids where name = 'e'));
update public.provider_links set url = 'https://github.com/eva-ai' where provider_id = (select id from ids where name = 'p');
select is((select verified_at from public.provider_links where provider_id = (select id from ids where name = 'p')), null, 'changing a link URL removes its verification');

select pg_temp.as_owner();
update public.providers set status = 'suspended' where id = (select id from ids where name = 'p');
select pg_temp.login((select id from ids where name = 'e'));
update public.providers set headline = 'Changed while suspended' where id = (select id from ids where name = 'p');
select is((select headline from public.providers where id = (select id from ids where name = 'p')), 'Voice agents for clinics', 'suspended providers cannot edit their profile');
select is((select count(*)::int from public.providers where id = (select id from ids where name = 'p')), 1, 'suspended providers can still see their own profile');

select * from finish();
rollback;
