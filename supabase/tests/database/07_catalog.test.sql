-- Service listings, portfolio, saved items, review queue and uploads.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

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
  ('e', pg_temp.new_user('expert@test.local', '{"full_name": "Eli Expert", "initial_role": "expert"}')),
  ('c', pg_temp.new_user('client@test.local', '{"full_name": "Cleo Client", "initial_role": "client"}'));
insert into ids select 'p', id from public.providers where owner_user_id = (select id from ids where name = 'e');
insert into public.categories (id, slug) values ('00000000-0000-4000-8000-0000000000c1', 'test-voice-agents');
insert into public.category_translations (category_id, locale, name) values ('00000000-0000-4000-8000-0000000000c1', 'en', 'Voice agents');
insert into public.taxonomy_terms (id, kind, slug) values ('00000000-0000-4000-8000-0000000000a1', 'technology', 'test-twilio');
insert into public.taxonomy_term_translations (term_id, locale, name) values ('00000000-0000-4000-8000-0000000000a1', 'en', 'Twilio');

-- Drafts -----------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'e'));
insert into public.service_listings (id, provider_id, slug, title)
values ('00000000-0000-4000-8000-0000000000d1', (select id from ids where name = 'p'), 'voice-agent', 'Voice agent');

select is(
  public.listing_checklist('00000000-0000-4000-8000-0000000000d1'),
  array['title', 'summary', 'description', 'category', 'skills', 'pricing'],
  'an empty draft lists everything that is missing'
);
select throws_ok($$ update public.service_listings set status = 'published' where id = '00000000-0000-4000-8000-0000000000d1' $$,
  '42501', null, 'owners cannot change the status directly');
select is(public.listings_submit_for_review('00000000-0000-4000-8000-0000000000d1'),
  array['title', 'summary', 'description', 'category', 'skills', 'pricing'], 'incomplete listings are not submitted');

update public.service_listings set
  title = 'AI phone receptionist for clinics',
  summary = 'An AI voice agent that answers calls and books appointments.',
  description = repeat('Detailed description of the service and what is included. ', 5) || ' Contact me at eli@example.com.',
  primary_category_id = '00000000-0000-4000-8000-0000000000c1',
  pricing_model = 'packages'
where id = '00000000-0000-4000-8000-0000000000d1';
insert into public.service_listing_terms (listing_id, term_id) values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1');
insert into public.service_packages (listing_id, tier, name, price_minor, delivery_days) values
  ('00000000-0000-4000-8000-0000000000d1', 1, 'Starter', 1500, 7);

select is(public.listing_checklist('00000000-0000-4000-8000-0000000000d1'), array['min_order'], 'prices below the minimum order are rejected');
update public.service_packages set price_minor = 150000 where listing_id = '00000000-0000-4000-8000-0000000000d1';
update public.service_listings set payment_model = 'deposit', deposit_bps = 2500, balance_trigger = 'before_final_delivery'
 where id = '00000000-0000-4000-8000-0000000000d1';
select is(public.listing_checklist('00000000-0000-4000-8000-0000000000d1'), array['deposit'], 'only allowed deposit percentages pass');
update public.service_listings set deposit_bps = 3000 where id = '00000000-0000-4000-8000-0000000000d1';
select is(public.listing_checklist('00000000-0000-4000-8000-0000000000d1'), '{}'::text[], 'a complete listing has an empty checklist');

select throws_ok($$ insert into public.service_packages (listing_id, tier, name, price_minor, delivery_days)
  select '00000000-0000-4000-8000-0000000000d1', g, 'Extra', 200000, 10 from generate_series(2, 4) g $$,
  null, null, 'a listing has at most three packages');
insert into public.service_listings (id, provider_id, slug, title)
values ('00000000-0000-4000-8000-0000000000d2', (select id from ids where name = 'p'), 'second', 'Second listing');
select throws_ok($$ insert into public.service_deliverables (listing_id, package_id, title)
  select '00000000-0000-4000-8000-0000000000d2', id, 'x' from public.service_packages where listing_id = '00000000-0000-4000-8000-0000000000d1' $$,
  '23514', null, 'deliverables must use a package of the same listing');

select pg_temp.login((select id from ids where name = 'c'));
select is((select count(*)::int from public.service_listings where id = '00000000-0000-4000-8000-0000000000d1'), 0, 'other users cannot see drafts');
select throws_ok($$ insert into public.service_listings (provider_id, slug, title) values ((select id from ids where name = 'p'), 'hijack', 'Hijack') $$,
  '42501', null, 'users cannot create listings for another provider');
select pg_temp.as_anon();
select is((select count(*)::int from public.service_listings where id = '00000000-0000-4000-8000-0000000000d1'), 0, 'visitors cannot see drafts');

-- Review -------------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'e'));
select is(public.listings_submit_for_review('00000000-0000-4000-8000-0000000000d1'), '{}'::text[], 'a complete listing is submitted');
select is((select status::text from public.service_listings where id = '00000000-0000-4000-8000-0000000000d1'), 'pending_review', 'the listing is in review');
select is((select flags from public.review_requests where target_id = '00000000-0000-4000-8000-0000000000d1' and status = 'pending'),
  array['contact_email'], 'contact details are flagged for moderators');
update public.service_listings set title = 'Changed during review!' where id = '00000000-0000-4000-8000-0000000000d1';
select is((select title from public.service_listings where id = '00000000-0000-4000-8000-0000000000d1'), 'AI phone receptionist for clinics',
  'listings cannot be edited while in review');

select pg_temp.login((select id from ids where name = 'c'));
select is((select count(*)::int from public.review_requests), 0, 'other users cannot see review requests');

-- Publication (staff approval is simulated here; see 09_staff.test.sql) ----------------------
select pg_temp.as_owner();
update public.service_listings set status = 'published', published_at = now() where id = '00000000-0000-4000-8000-0000000000d1';
update public.review_requests set status = 'approved', decided_at = now() where target_id = '00000000-0000-4000-8000-0000000000d1';

select pg_temp.as_anon();
select is((select count(*)::int from public.service_listings where id = '00000000-0000-4000-8000-0000000000d1'), 0,
  'published listings stay hidden until the provider is approved');
select pg_temp.as_owner();
update public.providers set status = 'active' where id = (select id from ids where name = 'p');
select pg_temp.as_anon();
select is((select count(*)::int from public.service_listings where id = '00000000-0000-4000-8000-0000000000d1'), 1, 'published listings of active providers are public');
select is((select count(*)::int from public.service_packages where listing_id = '00000000-0000-4000-8000-0000000000d1'), 1, 'their packages are public too');

select pg_temp.login((select id from ids where name = 'e'));
select lives_ok($$ update public.service_listings set summary = 'A voice agent that answers calls, books appointments and hands off to staff.'
  where id = '00000000-0000-4000-8000-0000000000d1' $$, 'published listings can be edited');
select is((select version from public.service_listings where id = '00000000-0000-4000-8000-0000000000d1') > 1, true, 'edits bump the version');
select is((select kind from public.review_requests where target_id = '00000000-0000-4000-8000-0000000000d1' and status = 'pending'), 'edit',
  'edits to a live listing are queued for a re-check');

-- Lifecycle ------------------------------------------------------------------------------------
select is(public.listings_change_status('00000000-0000-4000-8000-0000000000d1', 'pause')::text, 'paused', 'live listings can be paused');
select throws_ok($$ select public.listings_change_status('00000000-0000-4000-8000-0000000000d1', 'pause') $$, '55000', null, 'invalid transitions are refused');
select is(public.listings_change_status('00000000-0000-4000-8000-0000000000d1', 'resume')::text, 'published', 'paused listings can be resumed');
delete from public.service_listings where id = '00000000-0000-4000-8000-0000000000d1';
select is((select count(*)::int from public.service_listings where id = '00000000-0000-4000-8000-0000000000d1'), 1, 'published listings cannot be deleted, only archived');
delete from public.service_listings where id = '00000000-0000-4000-8000-0000000000d2';
select is((select count(*)::int from public.service_listings where id = '00000000-0000-4000-8000-0000000000d2'), 0, 'never-published drafts can be deleted');

-- Handles, portfolio, saved items ---------------------------------------------------------------
select throws_ok($$ select public.providers_set_handle('admin') $$, '22023', null, 'reserved handles are refused');
select lives_ok($$ select public.providers_set_handle('eli-voice') $$, 'experts can choose a free handle');
insert into public.portfolio_items (id, provider_id, title) values ('00000000-0000-4000-8000-0000000000f1', (select id from ids where name = 'p'), 'Clinic voice agent');
select throws_ok($$ update public.portfolio_items set provenance = 'greco_verified' where id = '00000000-0000-4000-8000-0000000000f1' $$,
  '42501', null, 'experts cannot mark their own work as verified');

select pg_temp.login((select id from ids where name = 'c'));
select lives_ok($$ insert into public.saved_services (user_id, listing_id) values ((select id from ids where name = 'c'), '00000000-0000-4000-8000-0000000000d1') $$,
  'clients can save public listings');
select is((select count(*)::int from public.portfolio_items where id = '00000000-0000-4000-8000-0000000000f1'), 1, 'portfolio items of active providers are public');
select throws_ok($$ select public.suggest_taxonomy_term('technology', 'Vapi') $$, '42501', null, 'only experts can suggest terms');
select throws_ok($$ select public.client_complete_onboarding() $$, '23514', null, 'clients choose an account type before finishing onboarding');

-- Uploads -----------------------------------------------------------------------------------------
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('public-media', '%s/avatar/x.webp') $$, (select id from ids where name = 'e')),
  '42501', null, 'users cannot upload into another user''s folder');
select pg_temp.login((select id from ids where name = 'e'));
select throws_ok(format($$ select public.register_uploaded_file('%s/avatar/missing.webp', 'avatar', 'image/webp', 100, null) $$, (select id from ids where name = 'e')),
  '22023', null, 'only files that were actually uploaded can be registered');

select * from finish();
rollback;
