-- Search index visibility, matching, synonyms and filters.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create function pg_temp.new_user(p_email text, p_meta jsonb) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, aud, role)
  values (v_id, p_email, p_meta, now(), 'authenticated', 'authenticated');
  return v_id;
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

-- Fixtures (as the table owner) ------------------------------------------------------------------
insert into public.categories (id, slug) values ('00000000-0000-4000-8000-0000000000c1', 'test-automation');
insert into public.category_translations (category_id, locale, name) values ('00000000-0000-4000-8000-0000000000c1', 'en', 'Automation');
insert into public.categories (id, parent_id, slug) values ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c1', 'phone-agents');
insert into public.category_translations (category_id, locale, name) values ('00000000-0000-4000-8000-0000000000c2', 'en', 'Phone agents');
insert into public.taxonomy_terms (id, kind, slug) values ('00000000-0000-4000-8000-0000000000a1', 'skill', 'test-rag');
insert into public.taxonomy_term_translations (term_id, locale, name) values ('00000000-0000-4000-8000-0000000000a1', 'en', 'Retrieval-augmented generation');
insert into public.taxonomy_term_aliases (term_id, alias) values ('00000000-0000-4000-8000-0000000000a1', 'ragx');

create temp table ids (name text primary key, id uuid not null);
grant select on ids to public;
insert into ids values
  ('e1', pg_temp.new_user('one@test.local', '{"full_name": "Vera Voice", "initial_role": "expert", "country_code": "PT"}')),
  ('e2', pg_temp.new_user('two@test.local', '{"full_name": "Dan Docs", "initial_role": "expert", "country_code": "DE"}'));
insert into ids select 'p1', id from public.providers where owner_user_id = (select id from ids where name = 'e1');
insert into ids select 'p2', id from public.providers where owner_user_id = (select id from ids where name = 'e2');
insert into public.provider_languages (provider_id, language_code, proficiency) values
  ((select id from ids where name = 'p1'), 'es', 'fluent');

insert into public.service_listings (id, provider_id, slug, title, summary, description, primary_category_id, pricing_model, base_delivery_days, fixed_price_minor, status, published_at)
values
  ('00000000-0000-4000-8000-0000000000d1', (select id from ids where name = 'p1'), 'receptionist', 'AI phone receptionist for clinics',
   'Answers calls and books appointments', 'A voice agent integrated with your booking software.', '00000000-0000-4000-8000-0000000000c2', 'fixed', 14, 180000, 'published', now()),
  ('00000000-0000-4000-8000-0000000000d2', (select id from ids where name = 'p2'), 'docs-bot', 'Chatbot trained on your documents',
   'A chatbot grounded in your knowledge base', 'Built with retrieval over your files.', '00000000-0000-4000-8000-0000000000c1', 'fixed', 7, 90000, 'published', now()),
  ('00000000-0000-4000-8000-0000000000d3', (select id from ids where name = 'p2'), 'draft', 'Unfinished voice draft',
   null, null, '00000000-0000-4000-8000-0000000000c2', 'fixed', 7, 50000, 'draft', null);
insert into public.service_listing_terms (listing_id, term_id) values ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a1');

select is((select count(*)::int from public.search_documents where entity_type = 'listing' and is_visible), 0,
  'listings of providers that are not yet active are indexed but hidden');
update public.providers set status = 'active', published_at = now() where id in ((select id from ids where name = 'p1'), (select id from ids where name = 'p2'));
select is((select count(*)::int from public.search_documents where entity_type = 'listing' and is_visible), 2,
  'approving the providers makes their published listings searchable');

-- Queries (as a visitor) -------------------------------------------------------------------------
select pg_temp.as_anon();
select is((select array_agg(slug order by slug) from public.search_listings()), array['docs-bot', 'receptionist'], 'an empty query lists every live listing');
select is((select array_agg(slug) from public.search_listings('receptionist')), array['receptionist'], 'full-text matches the title');
select is((select array_agg(slug) from public.search_listings('booking software')), array['receptionist'], 'full-text matches the description');
select is((select array_agg(slug) from public.search_listings('receptionst')), array['receptionist'], 'typos still match through trigram similarity');
select is((select array_agg(slug) from public.search_listings('ragx')), array['docs-bot'], 'taxonomy synonyms match tagged listings');
select is((select array_agg(slug order by slug) from public.search_listings('automation')), array['docs-bot', 'receptionist'],
  'a parent category name matches listings in its subcategories');
select is((select array_agg(slug order by slug) from public.search_listings(p_category_id => '00000000-0000-4000-8000-0000000000c1')), array['docs-bot', 'receptionist'],
  'category filters include the whole subtree');
select is((select array_agg(slug) from public.search_listings(p_currency => 'USD', p_max_price_minor => 100000)), array['docs-bot'], 'price filters apply');
select is((select array_agg(slug) from public.search_listings(p_language => 'es')), array['receptionist'], 'language filters use the expert''s languages');
select is((select array_agg(slug) from public.search_listings(p_sort => 'price_asc')), array['docs-bot', 'receptionist'], 'listings sort by price');
select is((select array_agg(display_name order by display_name) from public.search_providers(p_category_id => '00000000-0000-4000-8000-0000000000c2')),
  array['Vera Voice'], 'experts can be filtered by the categories of their live listings');
select is((select listing_count from public.category_listing_counts() where category_id = '00000000-0000-4000-8000-0000000000c1'), 2::bigint,
  'category counts include subcategories');

select * from finish();
rollback;
