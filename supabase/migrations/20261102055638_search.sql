-- Phase 3 search: one index used by marketplace search and, later, AI Discovery retrieval
-- (ARCHITECTURE.md §10, E-13). Documents refresh synchronously on change; the catalog is small,
-- and this keeps search correct without depending on the background job runner.

create table public.search_documents (
  entity_type text not null check (entity_type in ('listing', 'provider')),
  entity_id uuid not null,
  provider_id uuid not null references public.providers (id) on delete cascade,
  title text not null,
  summary text,
  document tsvector not null,
  category_ids uuid[] not null default '{}',
  category_paths extensions.ltree[] not null default '{}',
  term_ids uuid[] not null default '{}',
  provider_type public.provider_type,
  country_code char(2),
  language_codes text[] not null default '{}',
  price_from_minor bigint,
  currency char(3),
  delivery_days_min smallint,
  pricing_model public.pricing_model,
  rating_bayes numeric(4, 3),
  completed_orders integer not null default 0,
  is_visible boolean not null default false,
  published_at timestamptz,
  refreshed_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);
create index search_documents_document_idx on public.search_documents using gin (document);
create index search_documents_terms_idx on public.search_documents using gin (term_ids);
create index search_documents_paths_idx on public.search_documents using gist (category_paths);
create index search_documents_title_trgm_idx on public.search_documents using gin (title extensions.gin_trgm_ops);
create index search_documents_visible_idx on public.search_documents (entity_type, is_visible, published_at desc);
create index search_documents_provider_idx on public.search_documents (provider_id);

alter table public.search_documents enable row level security;
grant select on public.search_documents to anon, authenticated;
create policy search_documents_read on public.search_documents for select to anon, authenticated using (is_visible);

-- Text helpers --------------------------------------------------------------------------------
create function app_private.term_text(p_term_ids uuid[])
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(string_agg(x, ' '), '')
    from (
      select tt.name as x from public.taxonomy_term_translations tt
       where tt.term_id = any (p_term_ids) and tt.locale = 'en'
      union all
      select a.alias::text from public.taxonomy_term_aliases a where a.term_id = any (p_term_ids)
    ) words;
$$;

-- Names of the given categories and all their ancestors, so a parent category's name matches.
create function app_private.category_text(p_paths extensions.ltree[])
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(string_agg(ct.name, ' '), '')
    from public.categories c
    join public.category_translations ct on ct.category_id = c.id and ct.locale = 'en'
   where c.path operator(extensions.@>) p_paths;
$$;

create function app_private.weighted(p_text text, p_weight "char")
returns tsvector
language sql
stable
set search_path = ''
as $$
  select setweight(to_tsvector('english', extensions.unaccent(coalesce(p_text, ''))), p_weight);
$$;

-- Refresh -------------------------------------------------------------------------------------
create function app_private.refresh_listing_document(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_category_ids uuid[];
  v_paths extensions.ltree[];
  v_terms uuid[];
  v_price bigint;
  v_delivery smallint;
begin
  select l.*, p.status as provider_status, p.provider_type, p.country_code, p.display_name
    into r
    from public.service_listings l
    join public.providers p on p.id = l.provider_id
   where l.id = p_listing_id;

  if not found then
    delete from public.search_documents where entity_type = 'listing' and entity_id = p_listing_id;
    return;
  end if;

  select coalesce(array_agg(c.id), '{}'), coalesce(array_agg(c.path), '{}')
    into v_category_ids, v_paths
    from public.categories c
   where c.id = r.primary_category_id
      or c.id in (select lc.category_id from public.service_listing_categories lc where lc.listing_id = r.id);

  select coalesce(array_agg(lt.term_id), '{}') into v_terms
    from public.service_listing_terms lt where lt.listing_id = r.id;

  v_price := case r.pricing_model
    when 'fixed' then r.fixed_price_minor
    when 'hourly' then r.hourly_rate_minor * r.min_hours
    when 'packages' then (select min(p.price_minor) from public.service_packages p where p.listing_id = r.id and p.is_active)
    else r.quote_from_minor
  end;
  v_delivery := case r.pricing_model
    when 'packages' then (select min(p.delivery_days) from public.service_packages p where p.listing_id = r.id and p.is_active)
    else r.base_delivery_days
  end;

  insert into public.search_documents (
    entity_type, entity_id, provider_id, title, summary, document, category_ids, category_paths, term_ids,
    provider_type, country_code, language_codes, price_from_minor, currency, delivery_days_min, pricing_model,
    is_visible, published_at, refreshed_at
  ) values (
    'listing', r.id, r.provider_id, r.title, r.summary,
    app_private.weighted(r.title, 'A')
      || app_private.weighted(app_private.term_text(v_terms), 'A')
      || app_private.weighted(app_private.category_text(v_paths), 'B')
      || app_private.weighted(r.summary, 'B')
      || app_private.weighted(r.description, 'C')
      || app_private.weighted((select string_agg(concat_ws(' ', f.question, f.answer), ' ') from public.service_faqs f where f.listing_id = r.id), 'D')
      || app_private.weighted(r.display_name, 'D'),
    v_category_ids, v_paths, v_terms,
    r.provider_type, r.country_code,
    coalesce((select array_agg(pl.language_code order by pl.language_code) from public.provider_languages pl where pl.provider_id = r.provider_id), '{}'),
    v_price, r.currency, v_delivery, r.pricing_model,
    r.status = 'published' and r.provider_status = 'active',
    r.published_at, now()
  )
  on conflict (entity_type, entity_id) do update set
    provider_id = excluded.provider_id, title = excluded.title, summary = excluded.summary, document = excluded.document,
    category_ids = excluded.category_ids, category_paths = excluded.category_paths, term_ids = excluded.term_ids,
    provider_type = excluded.provider_type, country_code = excluded.country_code, language_codes = excluded.language_codes,
    price_from_minor = excluded.price_from_minor, currency = excluded.currency, delivery_days_min = excluded.delivery_days_min,
    pricing_model = excluded.pricing_model, is_visible = excluded.is_visible, published_at = excluded.published_at,
    refreshed_at = excluded.refreshed_at;
end;
$$;

create function app_private.refresh_provider_document(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.providers;
  v_terms uuid[];
  v_category_ids uuid[];
  v_paths extensions.ltree[];
  v_price bigint;
  v_currency char(3);
begin
  select * into p from public.providers where id = p_provider_id;
  if not found then
    delete from public.search_documents where entity_type = 'provider' and entity_id = p_provider_id;
    return;
  end if;

  select coalesce(array_agg(pt.term_id), '{}') into v_terms from public.provider_terms pt where pt.provider_id = p.id;

  -- Categories and starting price come from the expert's live listings.
  select coalesce(array_agg(distinct cid), '{}') into v_category_ids
    from public.search_documents d, unnest(d.category_ids) cid
   where d.entity_type = 'listing' and d.provider_id = p.id and d.is_visible;
  select coalesce(array_agg(c.path), '{}') into v_paths from public.categories c where c.id = any (v_category_ids);
  select d.price_from_minor, d.currency into v_price, v_currency
    from public.search_documents d
   where d.entity_type = 'listing' and d.provider_id = p.id and d.is_visible and d.price_from_minor is not null
   order by d.price_from_minor
   limit 1;

  insert into public.search_documents (
    entity_type, entity_id, provider_id, title, summary, document, category_ids, category_paths, term_ids,
    provider_type, country_code, language_codes, price_from_minor, currency, is_visible, published_at, refreshed_at
  ) values (
    'provider', p.id, p.id, p.display_name, p.headline,
    app_private.weighted(p.display_name, 'A')
      || app_private.weighted(p.headline, 'A')
      || app_private.weighted(app_private.term_text(v_terms), 'A')
      || app_private.weighted(app_private.category_text(v_paths), 'B')
      || app_private.weighted(p.bio, 'C')
      || app_private.weighted(p.city, 'D'),
    v_category_ids, v_paths, v_terms,
    p.provider_type, p.country_code,
    coalesce((select array_agg(pl.language_code order by pl.language_code) from public.provider_languages pl where pl.provider_id = p.id), '{}'),
    v_price, v_currency,
    p.status = 'active', p.published_at, now()
  )
  on conflict (entity_type, entity_id) do update set
    title = excluded.title, summary = excluded.summary, document = excluded.document,
    category_ids = excluded.category_ids, category_paths = excluded.category_paths, term_ids = excluded.term_ids,
    provider_type = excluded.provider_type, country_code = excluded.country_code, language_codes = excluded.language_codes,
    price_from_minor = excluded.price_from_minor, currency = excluded.currency, is_visible = excluded.is_visible,
    published_at = excluded.published_at, refreshed_at = excluded.refreshed_at;
end;
$$;

-- Everything for one provider: its listings first (the provider document aggregates them).
create function app_private.refresh_provider_and_listings(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing uuid;
begin
  for v_listing in select id from public.service_listings where provider_id = p_provider_id loop
    perform app_private.refresh_listing_document(v_listing);
  end loop;
  perform app_private.refresh_provider_document(p_provider_id);
end;
$$;

-- Used by admin functions when category or term names change.
create function app_private.refresh_all_search_documents()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid;
  v_count integer := 0;
begin
  for v_provider in select id from public.providers loop
    perform app_private.refresh_provider_and_listings(v_provider);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Triggers ------------------------------------------------------------------------------------
create function app_private.search_on_listing_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform app_private.refresh_listing_document(old.id);
    perform app_private.refresh_provider_document(old.provider_id);
  else
    perform app_private.refresh_listing_document(new.id);
    perform app_private.refresh_provider_document(new.provider_id);
  end if;
  return null;
end;
$$;
create trigger service_listings_search after insert or update or delete on public.service_listings
  for each row execute function app_private.search_on_listing_change();

create function app_private.search_on_provider_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.search_documents where provider_id = old.id;
  else
    perform app_private.refresh_provider_and_listings(new.id);
  end if;
  return null;
end;
$$;
create trigger providers_search after insert or update of display_name, headline, bio, city, status, provider_type, country_code, published_at, avatar_file_id
  on public.providers for each row execute function app_private.search_on_provider_change();
create trigger providers_search_delete after delete on public.providers
  for each row execute function app_private.search_on_provider_change();

create function app_private.search_on_provider_child_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid;
begin
  if tg_op = 'DELETE' then
    v_provider := old.provider_id;
  else
    v_provider := new.provider_id;
  end if;
  perform app_private.refresh_provider_and_listings(v_provider);
  return null;
end;
$$;
create trigger provider_terms_search after insert or update or delete on public.provider_terms
  for each row execute function app_private.search_on_provider_child_change();
create trigger provider_languages_search after insert or update or delete on public.provider_languages
  for each row execute function app_private.search_on_provider_child_change();

-- Search functions (SECURITY INVOKER: RLS still decides what each caller can see) --------------
create function public.search_listings(
  p_query text default null,
  p_category_id uuid default null,
  p_term_ids uuid[] default null,
  p_currency char(3) default null,
  p_min_price_minor bigint default null,
  p_max_price_minor bigint default null,
  p_max_delivery_days integer default null,
  p_provider_type public.provider_type default null,
  p_country char(2) default null,
  p_language text default null,
  p_pricing_model public.pricing_model default null,
  p_provider_id uuid default null,
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  listing_id uuid, slug text, title text, summary text, provider_id uuid, provider_handle text, provider_name text,
  provider_type public.provider_type, country_code char(2), avatar_path text, cover_path text,
  price_from_minor bigint, currency char(3), pricing_model public.pricing_model, delivery_days_min smallint,
  rank real, total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with params as (
    select nullif(btrim(p_query), '') as q,
           case when nullif(btrim(p_query), '') is null then null
                else websearch_to_tsquery('english', extensions.unaccent(btrim(p_query))) end as tsq,
           (select c.path from public.categories c where c.id = p_category_id) as cat_path
  ),
  alias_terms as (
    select coalesce(array_agg(distinct a.term_id), '{}') as ids
      from public.taxonomy_term_aliases a, params
     where params.q is not null
       and (a.alias = params.q::extensions.citext
            or a.alias = any (regexp_split_to_array(lower(params.q), '\s+')::extensions.citext[]))
  ),
  matches as (
    select d.*,
           (case when params.tsq is null then 0 else ts_rank_cd(d.document, params.tsq) end
            + case when params.q is null then 0 else extensions.word_similarity(params.q, d.title) * 0.5 end
            + case when d.term_ids && alias_terms.ids then 0.3 else 0 end)::real as score
      from public.search_documents d, params, alias_terms
     where d.entity_type = 'listing'
       and d.is_visible
       and (params.q is null
            or d.document @@ params.tsq
            or extensions.word_similarity(params.q, d.title) > 0.6
            or d.term_ids && alias_terms.ids)
       and (p_category_id is null or d.category_paths operator(extensions.<@) params.cat_path)
       and (p_term_ids is null or cardinality(p_term_ids) = 0 or d.term_ids && p_term_ids)
       and (p_currency is null or (p_min_price_minor is null and p_max_price_minor is null) or d.currency = p_currency)
       and (p_min_price_minor is null or d.price_from_minor >= p_min_price_minor)
       and (p_max_price_minor is null or d.price_from_minor <= p_max_price_minor)
       and (p_max_delivery_days is null or d.delivery_days_min <= p_max_delivery_days)
       and (p_provider_type is null or d.provider_type = p_provider_type)
       and (p_country is null or d.country_code = p_country)
       and (p_language is null or p_language = any (d.language_codes))
       and (p_pricing_model is null or d.pricing_model = p_pricing_model)
       and (p_provider_id is null or d.provider_id = p_provider_id)
  )
  select m.entity_id, l.slug::text, m.title, m.summary, m.provider_id, pr.handle::text, pr.display_name,
         m.provider_type, m.country_code, avatar.path, cover.path,
         m.price_from_minor, m.currency, m.pricing_model, m.delivery_days_min,
         m.score, count(*) over ()
    from matches m
    join public.service_listings l on l.id = m.entity_id
    join public.providers pr on pr.id = m.provider_id
    left join public.file_objects avatar on avatar.id = pr.avatar_file_id
    left join lateral (
      select f.path from public.service_media sm join public.file_objects f on f.id = sm.file_id
       where sm.listing_id = m.entity_id order by sm.sort_order limit 1
    ) cover on true
   order by
     case when p_sort = 'price_asc' then m.price_from_minor end asc nulls last,
     case when p_sort = 'price_desc' then m.price_from_minor end desc nulls last,
     case when p_sort = 'delivery' then m.delivery_days_min end asc nulls last,
     case when p_sort = 'newest' then m.published_at end desc nulls last,
     m.score desc,
     m.published_at desc nulls last,
     m.entity_id
   limit greatest(1, least(coalesce(p_limit, 24), 60))
  offset greatest(0, least(coalesce(p_offset, 0), 10000));
$$;

create function public.search_providers(
  p_query text default null,
  p_category_id uuid default null,
  p_term_ids uuid[] default null,
  p_provider_type public.provider_type default null,
  p_country char(2) default null,
  p_language text default null,
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  provider_id uuid, handle text, display_name text, headline text, provider_type public.provider_type,
  country_code char(2), language_codes text[], avatar_path text, availability public.availability_status,
  experience_level public.experience_level, price_from_minor bigint, currency char(3), listing_count bigint,
  rank real, total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with params as (
    select nullif(btrim(p_query), '') as q,
           case when nullif(btrim(p_query), '') is null then null
                else websearch_to_tsquery('english', extensions.unaccent(btrim(p_query))) end as tsq,
           (select c.path from public.categories c where c.id = p_category_id) as cat_path
  ),
  alias_terms as (
    select coalesce(array_agg(distinct a.term_id), '{}') as ids
      from public.taxonomy_term_aliases a, params
     where params.q is not null
       and (a.alias = params.q::extensions.citext
            or a.alias = any (regexp_split_to_array(lower(params.q), '\s+')::extensions.citext[]))
  ),
  matches as (
    select d.*,
           (case when params.tsq is null then 0 else ts_rank_cd(d.document, params.tsq) end
            + case when params.q is null then 0 else extensions.word_similarity(params.q, d.title) * 0.5 end
            + case when d.term_ids && alias_terms.ids then 0.3 else 0 end)::real as score
      from public.search_documents d, params, alias_terms
     where d.entity_type = 'provider'
       and d.is_visible
       and (params.q is null
            or d.document @@ params.tsq
            or extensions.word_similarity(params.q, d.title) > 0.6
            or d.term_ids && alias_terms.ids)
       and (p_category_id is null or d.category_paths operator(extensions.<@) params.cat_path)
       and (p_term_ids is null or cardinality(p_term_ids) = 0 or d.term_ids && p_term_ids)
       and (p_provider_type is null or d.provider_type = p_provider_type)
       and (p_country is null or d.country_code = p_country)
       and (p_language is null or p_language = any (d.language_codes))
  )
  select m.entity_id, pr.handle::text, pr.display_name, pr.headline, m.provider_type, m.country_code, m.language_codes,
         avatar.path, pr.availability, pr.experience_level, m.price_from_minor, m.currency,
         (select count(*) from public.search_documents ld
           where ld.entity_type = 'listing' and ld.provider_id = m.entity_id and ld.is_visible),
         m.score, count(*) over ()
    from matches m
    join public.providers pr on pr.id = m.entity_id
    left join public.file_objects avatar on avatar.id = pr.avatar_file_id
   order by
     case when p_sort = 'newest' then m.published_at end desc nulls last,
     m.score desc,
     m.published_at desc nulls last,
     m.entity_id
   limit greatest(1, least(coalesce(p_limit, 24), 60))
  offset greatest(0, least(coalesce(p_offset, 0), 10000));
$$;

-- Live listings per category, counting every listing in the category's subtree.
create function public.category_listing_counts()
returns table (category_id uuid, listing_count bigint)
language sql
stable
set search_path = ''
as $$
  select c.id, count(d.entity_id)
    from public.categories c
    left join public.search_documents d
      on d.entity_type = 'listing' and d.is_visible and d.category_paths operator(extensions.<@) c.path
   where c.is_active
   group by c.id;
$$;

revoke all on function public.search_listings(text, uuid, uuid[], char, bigint, bigint, integer, public.provider_type, char, text, public.pricing_model, uuid, text, integer, integer) from public;
revoke all on function public.search_providers(text, uuid, uuid[], public.provider_type, char, text, text, integer, integer) from public;
revoke all on function public.category_listing_counts() from public;
grant execute on function public.search_listings(text, uuid, uuid[], char, bigint, bigint, integer, public.provider_type, char, text, public.pricing_model, uuid, text, integer, integer) to anon, authenticated;
grant execute on function public.search_providers(text, uuid, uuid[], public.provider_type, char, text, text, integer, integer) to anon, authenticated;
grant execute on function public.category_listing_counts() to anon, authenticated;

revoke all on all functions in schema app_private from public, anon, authenticated;

-- Index anything that already exists.
select app_private.refresh_all_search_documents();
