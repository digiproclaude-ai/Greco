-- Staff functions: MFA-gated moderation, suspensions, categories and taxonomy.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

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
  ('admin', pg_temp.new_user('admin@test.local', '{"full_name": "Ada Admin"}')),
  ('mod', pg_temp.new_user('mod@test.local', '{"full_name": "Mo Moderator"}')),
  ('e', pg_temp.new_user('exp@test.local', '{"full_name": "Ezra Expert", "initial_role": "expert", "country_code": "FR"}'));
insert into ids select 'p', id from public.providers where owner_user_id = (select id from ids where name = 'e');
insert into public.staff_roles (user_id, role) values ((select id from ids where name = 'admin'), 'admin'), ((select id from ids where name = 'mod'), 'moderator');

-- An expert with a submitted profile and listing.
update public.providers set headline = 'Voice agents for small businesses', bio = repeat('I build reliable voice agents. ', 5),
  experience_level = 'expert' where id = (select id from ids where name = 'p');
insert into public.provider_languages (provider_id, language_code, proficiency) values ((select id from ids where name = 'p'), 'fr', 'native');
insert into public.provider_terms (provider_id, term_id)
  select (select id from ids where name = 'p'), id from public.taxonomy_terms where slug in ('twilio', 'vapi', 'voice-ai');
insert into public.service_listings (id, provider_id, slug, title, summary, description, primary_category_id, pricing_model, fixed_price_minor, base_delivery_days)
values ('00000000-0000-4000-8000-0000000000d1', (select id from ids where name = 'p'), 'receptionist', 'AI receptionist for small clinics',
  'Answers calls, books appointments and hands over to your team.', repeat('Everything included in this service, step by step. ', 6),
  (select id from public.categories where slug = 'ai-receptionists'), 'fixed', 120000, 14);
insert into public.service_listing_terms (listing_id, term_id) select '00000000-0000-4000-8000-0000000000d1', id from public.taxonomy_terms where slug = 'vapi';

select pg_temp.login((select id from ids where name = 'e'));
select is(public.providers_submit_for_review(), '{}'::text[], 'a complete profile is submitted');
select is(public.listings_submit_for_review('00000000-0000-4000-8000-0000000000d1'), '{}'::text[], 'a complete listing is submitted');

create temp table reqs as select id, target_type from public.review_requests where status = 'pending';
grant select on reqs to public;

-- Access ---------------------------------------------------------------------------------------
select throws_ok($$ select public.admin_review((select id from reqs where target_type = 'provider'), 'approve') $$, '42501', null,
  'experts cannot moderate');
select pg_temp.login((select id from ids where name = 'mod'), 'aal1');
select throws_ok($$ select public.admin_review((select id from reqs where target_type = 'provider'), 'approve') $$, '42501', null,
  'staff without two-step verification cannot moderate');

-- Decisions --------------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'mod'), 'aal2');
select lives_ok($$ select public.admin_review((select id from reqs where target_type = 'provider'), 'approve') $$, 'moderators approve profiles');
select throws_ok($$ select public.admin_review((select id from reqs where target_type = 'listing'), 'reject', 'too short') $$, '22023', null,
  'rejections need a statement of reasons');
select lives_ok($$ select public.admin_review((select id from reqs where target_type = 'listing'), 'reject', 'Please remove the phone number from the description.') $$,
  'moderators reject listings with a reason');

select pg_temp.as_owner();
select is((select status::text from public.providers where id = (select id from ids where name = 'p')), 'active', 'approval activates the profile');
select is((select status::text from public.service_listings where id = '00000000-0000-4000-8000-0000000000d1'), 'rejected', 'rejection sends the listing back');
select is((select count(*)::int from app_private.audit_logs where action in ('moderation.approve', 'moderation.reject')), 2, 'decisions are audited');

select pg_temp.login((select id from ids where name = 'e'));
select is((select reason from public.review_requests where target_type = 'listing' order by submitted_at desc limit 1),
  'Please remove the phone number from the description.', 'the expert can read the statement of reasons');
select is(public.listings_submit_for_review('00000000-0000-4000-8000-0000000000d1'), '{}'::text[], 'a rejected listing can be resubmitted');

select pg_temp.login((select id from ids where name = 'mod'), 'aal2');
select lives_ok($$ select public.admin_review((select id from public.review_requests where target_type = 'listing' and status = 'pending'), 'approve') $$,
  'the resubmitted listing is approved');
select pg_temp.as_anon();
select is((select count(*)::int from public.search_listings('receptionist')), 1, 'approved listings become searchable');

-- Suspensions ----------------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'mod'), 'aal2');
select lives_ok($$ select public.admin_set_status('listing', '00000000-0000-4000-8000-0000000000d1', 'suspend', 'Reported for misleading claims, under review.') $$,
  'moderators suspend listings with a reason');
select pg_temp.as_anon();
select is((select count(*)::int from public.service_listings where id = '00000000-0000-4000-8000-0000000000d1'), 0, 'suspended listings disappear');
select pg_temp.login((select id from ids where name = 'mod'), 'aal2');
select lives_ok($$ select public.admin_set_status('listing', '00000000-0000-4000-8000-0000000000d1', 'reinstate') $$, 'and reinstate them');

-- Categories and taxonomy ---------------------------------------------------------------------------
select throws_ok($$ select public.admin_save_category(null, null, 'robotics', 'Robotics') $$, '42501', null,
  'moderators cannot manage categories');
select pg_temp.login((select id from ids where name = 'admin'), 'aal2');
select lives_ok($$ select public.admin_save_category(null, null, 'robotics', 'Robotics', 'Robots that see and act') $$, 'admins create categories');
select lives_ok($$ select public.admin_save_category(
  (select id from public.categories where slug = 'ai-receptionists'),
  (select id from public.categories where slug = 'voice-agents-phone' and parent_id is null),
  'ai-receptionists', 'Virtual front desk') $$, 'admins rename categories');
select pg_temp.as_anon();
select is((select count(*)::int from public.search_listings('virtual front desk')), 1, 'renamed categories are searchable right away');

select pg_temp.login((select id from ids where name = 'admin'), 'aal2');
select lives_ok($$ select public.admin_set_category_active((select id from public.categories where slug = 'voice-agents-phone' and parent_id is null), false) $$,
  'admins deactivate a category tree');
select throws_ok($$ select public.admin_set_category_active((select id from public.categories where slug = 'ai-receptionists'), true) $$, '55000', null,
  'a subcategory cannot be active under an inactive parent');

select lives_ok($$ select public.admin_merge_term((select id from public.taxonomy_terms where slug = 'vapi'), (select id from public.taxonomy_terms where slug = 'voice-ai')) $$,
  'terms can be merged; tags move to the surviving term');

select * from finish();
rollback;
