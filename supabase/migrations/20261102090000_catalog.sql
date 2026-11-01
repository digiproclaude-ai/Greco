-- Phase 3 catalog: service listings, portfolio, saved items, moderation queue and public media.
-- See DATABASE_SCHEMA.md §6 (catalog), §7 (portfolio), §16 (trust and safety), §17 (saved items).

-- Types ----------------------------------------------------------------------------
create type public.listing_status as enum ('draft', 'pending_review', 'published', 'paused', 'archived', 'rejected', 'suspended');
create type public.pricing_model as enum ('fixed', 'packages', 'hourly', 'quote');
create type public.payment_model as enum ('full', 'deposit');
create type public.balance_trigger as enum ('on_milestone_acceptance', 'before_final_delivery');
create type public.requirement_input as enum ('text', 'long_text', 'url', 'choice', 'multi_choice');
create type public.portfolio_provenance as enum ('self_reported', 'greco_order', 'greco_verified');
create type public.portfolio_status as enum ('draft', 'published', 'hidden');

-- Completeness is computed by provider_profile_checklist() instead of a stored number.
alter table public.providers drop column profile_completeness;
alter table public.providers add column submitted_at timestamptz;

-- Service listings -------------------------------------------------------------------
create table public.service_listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete restrict,
  slug extensions.citext not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  status public.listing_status not null default 'draft',
  title text not null check (char_length(title) between 3 and 100),
  summary text check (char_length(summary) <= 200),
  description text check (char_length(description) <= 8000),
  primary_category_id uuid references public.categories (id) on delete restrict,
  pricing_model public.pricing_model not null default 'packages',
  -- Launch currencies (A-09). Adding one is a migration plus a setting change.
  currency char(3) not null default 'USD' check (currency in ('USD', 'EUR')),
  fixed_price_minor bigint check (fixed_price_minor > 0),
  hourly_rate_minor bigint check (hourly_rate_minor > 0),
  min_hours smallint check (min_hours between 1 and 1000),
  quote_from_minor bigint check (quote_from_minor > 0),
  base_delivery_days smallint check (base_delivery_days between 1 and 365),
  payment_model public.payment_model not null default 'full',
  deposit_bps integer check (deposit_bps between 1000 and 9000),
  balance_trigger public.balance_trigger,
  revisions_included smallint check (revisions_included between 0 and 20),
  revision_policy text check (char_length(revision_policy) <= 1000),
  requirements_intro text check (char_length(requirements_intro) <= 1000),
  source_locale text not null default 'en' check (source_locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  version integer not null default 1,
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, slug),
  check (payment_model = 'full' or (deposit_bps is not null and balance_trigger is not null))
);
create index service_listings_provider_idx on public.service_listings (provider_id, status);
create index service_listings_status_idx on public.service_listings (status, published_at desc);
create index service_listings_category_idx on public.service_listings (primary_category_id);
create trigger service_listings_set_updated_at before update on public.service_listings
  for each row execute function extensions.moddatetime(updated_at);

create table public.service_listing_categories (
  listing_id uuid not null references public.service_listings (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (listing_id, category_id)
);
create index service_listing_categories_category_idx on public.service_listing_categories (category_id);

create table public.service_listing_terms (
  listing_id uuid not null references public.service_listings (id) on delete cascade,
  term_id uuid not null references public.taxonomy_terms (id) on delete cascade,
  primary key (listing_id, term_id)
);
create index service_listing_terms_term_idx on public.service_listing_terms (term_id);

create table public.service_packages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings (id) on delete cascade,
  tier smallint not null check (tier between 1 and 3),
  name text not null check (char_length(name) between 1 and 40),
  description text check (char_length(description) <= 500),
  price_minor bigint not null check (price_minor > 0),
  delivery_days smallint not null check (delivery_days between 1 and 365),
  revisions_included smallint not null default 1 check (revisions_included between 0 and 20),
  is_active boolean not null default true,
  unique (listing_id, tier)
);

create table public.service_deliverables (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings (id) on delete cascade,
  package_id uuid references public.service_packages (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  sort_order smallint not null default 0
);
create index service_deliverables_listing_idx on public.service_deliverables (listing_id, sort_order);
create index service_deliverables_package_idx on public.service_deliverables (package_id) where package_id is not null;

create table public.service_addons (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 500),
  price_minor bigint not null check (price_minor > 0),
  extra_delivery_days smallint not null default 0 check (extra_delivery_days between 0 and 180),
  is_active boolean not null default true,
  sort_order smallint not null default 0
);
create index service_addons_listing_idx on public.service_addons (listing_id, sort_order);

create table public.service_requirements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings (id) on delete cascade,
  prompt text not null check (char_length(prompt) between 3 and 300),
  input_type public.requirement_input not null default 'long_text',
  options text[] check (cardinality(options) <= 12),
  is_required boolean not null default true,
  sort_order smallint not null default 0,
  check (input_type not in ('choice', 'multi_choice') or coalesce(cardinality(options), 0) >= 2)
);
create index service_requirements_listing_idx on public.service_requirements (listing_id, sort_order);

create table public.service_faqs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings (id) on delete cascade,
  question text not null check (char_length(question) between 3 and 200),
  answer text not null check (char_length(answer) between 1 and 1500),
  sort_order smallint not null default 0
);
create index service_faqs_listing_idx on public.service_faqs (listing_id, sort_order);

create table public.service_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings (id) on delete cascade,
  file_id uuid not null references public.file_objects (id) on delete cascade,
  alt_text text not null check (char_length(alt_text) between 1 and 200),
  sort_order smallint not null default 0
);
create index service_media_listing_idx on public.service_media (listing_id, sort_order);
create index service_media_file_idx on public.service_media (file_id);

-- Portfolio ----------------------------------------------------------------------------
create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  summary text check (char_length(summary) <= 300),
  problem text check (char_length(problem) <= 2000),
  solution text check (char_length(solution) <= 3000),
  results text check (char_length(results) <= 2000),
  role text check (char_length(role) <= 120),
  client_display_name text check (char_length(client_display_name) <= 120),
  industry_term_id uuid references public.taxonomy_terms (id) on delete set null,
  project_date date,
  external_url text check (external_url ~* '^https://[^\s]+$' and char_length(external_url) <= 300),
  -- Raised only by system functions (greco_order, greco_verified); owners create self_reported items.
  provenance public.portfolio_provenance not null default 'self_reported',
  status public.portfolio_status not null default 'published',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_items_provider_idx on public.portfolio_items (provider_id, sort_order);
create index portfolio_items_industry_idx on public.portfolio_items (industry_term_id) where industry_term_id is not null;
create trigger portfolio_items_set_updated_at before update on public.portfolio_items
  for each row execute function extensions.moddatetime(updated_at);

create table public.portfolio_item_terms (
  item_id uuid not null references public.portfolio_items (id) on delete cascade,
  term_id uuid not null references public.taxonomy_terms (id) on delete cascade,
  primary key (item_id, term_id)
);
create index portfolio_item_terms_term_idx on public.portfolio_item_terms (term_id);

create table public.portfolio_item_media (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.portfolio_items (id) on delete cascade,
  file_id uuid not null references public.file_objects (id) on delete cascade,
  caption text check (char_length(caption) <= 200),
  sort_order smallint not null default 0
);
create index portfolio_item_media_item_idx on public.portfolio_item_media (item_id, sort_order);
create index portfolio_item_media_file_idx on public.portfolio_item_media (file_id);

-- Saved items ------------------------------------------------------------------------
create table public.saved_providers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, provider_id)
);
create index saved_providers_provider_idx on public.saved_providers (provider_id);

create table public.saved_services (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.service_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index saved_services_listing_idx on public.saved_services (listing_id);

create table public.saved_categories (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);
create index saved_categories_category_idx on public.saved_categories (category_id);

-- Moderation -----------------------------------------------------------------------------
-- Review queue. Kept apart from listings/providers so flags and decisions are never public.
create table public.review_requests (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('provider', 'listing')),
  target_id uuid not null,
  provider_id uuid not null references public.providers (id) on delete cascade,
  kind text not null default 'initial' check (kind in ('initial', 'edit')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'superseded')),
  flags text[] not null default '{}',
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  reason text check (char_length(reason) <= 2000)
);
create unique index review_requests_one_pending on public.review_requests (target_type, target_id) where status = 'pending';
create index review_requests_queue_idx on public.review_requests (status, submitted_at);
create index review_requests_provider_idx on public.review_requests (provider_id, submitted_at desc);
create index review_requests_decided_by_idx on public.review_requests (decided_by) where decided_by is not null;

-- Log of moderation decisions with the statement of reasons shown to the affected expert (DSA/P2B).
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('provider', 'listing', 'portfolio_item', 'term', 'category')),
  target_id uuid not null,
  provider_id uuid references public.providers (id) on delete cascade,
  action text not null check (action in ('approve', 'reject', 'suspend', 'reinstate')),
  reason text check (char_length(reason) <= 2000),
  actor_staff_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index moderation_actions_target_idx on public.moderation_actions (target_type, target_id, created_at desc);
create index moderation_actions_provider_idx on public.moderation_actions (provider_id) where provider_id is not null;
create index moderation_actions_actor_idx on public.moderation_actions (actor_staff_id) where actor_staff_id is not null;

-- Helpers ------------------------------------------------------------------------------------
create function app.owns_listing(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.service_listings l
      join public.providers p on p.id = l.provider_id
     where l.id = p_listing_id and p.owner_user_id = auth.uid()
  );
$$;

create function app.listing_is_visible(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.service_listings l
      join public.providers p on p.id = l.provider_id
     where l.id = p_listing_id
       and ((l.status = 'published' and p.status = 'active') or p.owner_user_id = auth.uid())
  ) or app.is_staff();
$$;

-- Owners edit drafts, rejected, published and paused listings (not while in review or suspended).
create function app.listing_is_editable(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_role('expert') and exists (
    select 1
      from public.service_listings l
      join public.providers p on p.id = l.provider_id
     where l.id = p_listing_id
       and p.owner_user_id = auth.uid()
       and p.status not in ('suspended', 'deactivated')
       and l.status in ('draft', 'rejected', 'published', 'paused')
  );
$$;

create function app.portfolio_item_is_visible(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.portfolio_items i
      join public.providers p on p.id = i.provider_id
     where i.id = p_item_id
       and ((i.status = 'published' and p.status = 'active') or p.owner_user_id = auth.uid())
  ) or app.is_staff();
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;

-- Flags for moderators: contact details (D-08: all communication on Greco) and prompt-injection
-- attempts aimed at AI Discovery (docs/AI_DISCOVERY.md §7).
create function app_private.detect_review_flags(p_text text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct flag order by flag), '{}')
    from unnest(array[
      case when p_text ~* '(ignore|disregard|forget|override)\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier|system)\s+(instructions|prompts|rules|messages)' then 'prompt_injection' end,
      case when p_text ~* '(system prompt|developer message|you are now|act as (the|an?) (ai|assistant)|rank (me|this|us) (first|highest|at the top))' then 'prompt_injection' end,
      case when p_text ~* '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}' then 'contact_email' end,
      case when p_text ~* '\+?\d[\d\s().-]{7,}\d' then 'contact_phone' end,
      case when p_text ~* '(whatsapp|telegram|t\.me/|wa\.me/|signal\.me|skype|discord\.gg|wechat)' then 'contact_messenger' end
    ]) as flag
   where flag is not null;
$$;

create function app_private.listing_text(p_listing_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select concat_ws(' ', l.title, l.summary, l.description, l.revision_policy, l.requirements_intro,
           (select string_agg(concat_ws(' ', f.question, f.answer), ' ') from public.service_faqs f where f.listing_id = l.id),
           (select string_agg(concat_ws(' ', p.name, p.description), ' ') from public.service_packages p where p.listing_id = l.id),
           (select string_agg(concat_ws(' ', a.title, a.description), ' ') from public.service_addons a where a.listing_id = l.id))
    from public.service_listings l
   where l.id = p_listing_id;
$$;

create function app_private.provider_text(p_provider_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select concat_ws(' ', p.display_name, p.headline, p.bio, p.availability_note, p.city)
    from public.providers p
   where p.id = p_provider_id;
$$;

create function app_private.setting_minor(p_key text, p_currency char(3), p_default bigint)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce((select (s.value ->> p_currency)::bigint from public.platform_settings s where s.key = p_key), p_default);
$$;

-- Checklists (single source of truth for "ready to submit"; also shown in the editors) -------
create function public.provider_profile_checklist(p_provider_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  -- Only the owner and staff may inspect a profile's checklist.
  select case when not (app.owns_provider(p_provider_id) or app.is_staff()) then null else (
  select coalesce(array_agg(item order by item), '{}')
    from (
      select 'headline' as item from public.providers p where p.id = p_provider_id and char_length(coalesce(p.headline, '')) < 10
      union all
      select 'bio' from public.providers p where p.id = p_provider_id and char_length(coalesce(p.bio, '')) < 100
      union all
      select 'country' from public.providers p where p.id = p_provider_id and p.country_code is null
      union all
      select 'experience' from public.providers p where p.id = p_provider_id and p.experience_level is null
      union all
      select 'skills' where (
        select count(*) from public.provider_terms pt join public.taxonomy_terms t on t.id = pt.term_id
         where pt.provider_id = p_provider_id and t.status = 'active'
      ) < 3
      union all
      select 'languages' where not exists (select 1 from public.provider_languages l where l.provider_id = p_provider_id)
    ) missing) end;
$$;

create function public.listing_checklist(p_listing_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l public.service_listings;
  v_missing text[] := '{}';
  v_min_order bigint;
  v_order_value bigint;
  v_allowed jsonb;
begin
  if not (app.owns_listing(p_listing_id) or app.is_staff()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into l from public.service_listings where id = p_listing_id;
  if not found then
    return array['not_found'];
  end if;

  v_min_order := app_private.setting_minor('payments.min_order_minor', l.currency, 2500);

  if char_length(l.title) < 15 then v_missing := array_append(v_missing, 'title'); end if;
  if char_length(coalesce(l.summary, '')) < 40 then v_missing := array_append(v_missing, 'summary'); end if;
  if char_length(coalesce(l.description, '')) < 200 then v_missing := array_append(v_missing, 'description'); end if;
  if l.primary_category_id is null
     or not exists (select 1 from public.categories c where c.id = l.primary_category_id and c.is_active) then
    v_missing := array_append(v_missing, 'category');
  end if;
  if not exists (
    select 1 from public.service_listing_terms lt join public.taxonomy_terms t on t.id = lt.term_id
     where lt.listing_id = l.id and t.status = 'active'
  ) then
    v_missing := array_append(v_missing, 'skills');
  end if;

  v_order_value := case l.pricing_model
    when 'fixed' then l.fixed_price_minor
    when 'hourly' then l.hourly_rate_minor * l.min_hours
    when 'packages' then (select min(p.price_minor) from public.service_packages p where p.listing_id = l.id and p.is_active)
    else null
  end;

  if l.pricing_model = 'fixed' and (l.fixed_price_minor is null or l.base_delivery_days is null) then
    v_missing := array_append(v_missing, 'pricing');
  elsif l.pricing_model = 'hourly' and (l.hourly_rate_minor is null or l.min_hours is null or l.base_delivery_days is null) then
    v_missing := array_append(v_missing, 'pricing');
  elsif l.pricing_model = 'packages' and v_order_value is null then
    v_missing := array_append(v_missing, 'pricing');
  elsif v_order_value is not null and v_order_value < v_min_order then
    v_missing := array_append(v_missing, 'min_order');
  end if;

  if l.payment_model = 'deposit' then
    select s.value into v_allowed from public.platform_settings s where s.key = 'payments.deposit_allowed_bps';
    if l.deposit_bps is null or not (coalesce(v_allowed, '[2000,3000,4000,5000]'::jsonb) @> to_jsonb(l.deposit_bps)) then
      v_missing := array_append(v_missing, 'deposit');
    elsif l.pricing_model <> 'quote'
          and coalesce(v_order_value, 0) < app_private.setting_minor('payments.deposit_min_order_minor', l.currency, 30000) then
      v_missing := array_append(v_missing, 'deposit_min_order');
    end if;
  end if;

  return v_missing;
end;
$$;

-- Listing change tracking --------------------------------------------------------------------
-- Any content change bumps the version (offers snapshot it later). Edits to a published listing
-- queue a re-check for moderators while the listing stays live.
create function app_private.queue_listing_edit_review(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid;
  v_status public.listing_status;
begin
  select provider_id, status into v_provider, v_status from public.service_listings where id = p_listing_id;
  if v_status = 'published' then
    insert into public.review_requests (target_type, target_id, provider_id, kind, flags)
    values ('listing', p_listing_id, v_provider, 'edit', app_private.detect_review_flags(app_private.listing_text(p_listing_id)))
    on conflict (target_type, target_id) where status = 'pending'
    do update set flags = excluded.flags;
  end if;
end;
$$;

create function app_private.service_listings_track_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Admin maintenance (for example reassigning a deactivated category) is not an expert edit.
  if current_setting('greco.system_change', true) = 'on' then
    return new;
  end if;
  if (new.title, new.summary, new.description, new.primary_category_id, new.pricing_model, new.currency,
      new.fixed_price_minor, new.hourly_rate_minor, new.min_hours, new.quote_from_minor, new.base_delivery_days,
      new.payment_model, new.deposit_bps, new.balance_trigger, new.revisions_included, new.revision_policy,
      new.requirements_intro, new.slug)
     is distinct from
     (old.title, old.summary, old.description, old.primary_category_id, old.pricing_model, old.currency,
      old.fixed_price_minor, old.hourly_rate_minor, old.min_hours, old.quote_from_minor, old.base_delivery_days,
      old.payment_model, old.deposit_bps, old.balance_trigger, old.revisions_included, old.revision_policy,
      old.requirements_intro, old.slug) then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;
create trigger service_listings_track_changes before update on public.service_listings
  for each row execute function app_private.service_listings_track_changes();

create function app_private.service_listings_after_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.version > old.version then
    perform app_private.queue_listing_edit_review(new.id);
  end if;
  return null;
end;
$$;
create trigger service_listings_after_edit after update on public.service_listings
  for each row execute function app_private.service_listings_after_edit();

-- Child rows: bump the parent version and queue a re-check if it is published.
create function app_private.listing_child_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing uuid;
begin
  if tg_op = 'DELETE' then
    v_listing := old.listing_id;
  else
    v_listing := new.listing_id;
  end if;
  update public.service_listings set version = version + 1 where id = v_listing;
  perform app_private.queue_listing_edit_review(v_listing);
  return null;
end;
$$;

-- Upper bounds on child rows per listing (TG_ARGV[0] = maximum).
create function app_private.enforce_listing_child_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  execute format('select count(*) from public.%I where listing_id = $1', tg_table_name)
    into v_count using new.listing_id;
  if v_count > tg_argv[0]::integer then
    raise exception 'too many rows in % for this listing (maximum %)', tg_table_name, tg_argv[0]
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('service_listing_categories', 2), ('service_listing_terms', 15), ('service_packages', 3),
      ('service_deliverables', 30), ('service_addons', 10), ('service_requirements', 15),
      ('service_faqs', 15), ('service_media', 8)
    ) as v (name, max_rows)
  loop
    execute format(
      'create trigger %I after insert on public.%I for each row execute function app_private.enforce_listing_child_limit(%L)',
      t.name || '_limit', t.name, t.max_rows);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function app_private.listing_child_changed()',
      t.name || '_changed', t.name);
  end loop;
end;
$$;

-- Owner functions ----------------------------------------------------------------------------
-- Returns the missing checklist items; an empty array means the listing was submitted.
create function public.listings_submit_for_review(p_listing_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.service_listings;
  v_missing text[];
begin
  if not app.owns_listing(p_listing_id) or not app.has_role('expert') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_listing from public.service_listings where id = p_listing_id for update;
  if v_listing.status not in ('draft', 'rejected') then
    raise exception 'listing cannot be submitted from status %', v_listing.status using errcode = '55000';
  end if;

  v_missing := public.listing_checklist(p_listing_id);
  if cardinality(v_missing) > 0 then
    return v_missing;
  end if;

  update public.service_listings set status = 'pending_review', submitted_at = now() where id = p_listing_id;
  update public.review_requests set status = 'superseded'
   where target_type = 'listing' and target_id = p_listing_id and status = 'pending';
  insert into public.review_requests (target_type, target_id, provider_id, kind, flags)
  values ('listing', p_listing_id, v_listing.provider_id, 'initial',
          app_private.detect_review_flags(app_private.listing_text(p_listing_id)));

  perform app_private.write_audit('listing.submitted', 'listing', p_listing_id::text);
  perform app_private.enqueue_event('listing.submitted', 'listing', p_listing_id);
  return '{}';
end;
$$;

create function public.providers_submit_for_review()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider public.providers;
  v_missing text[];
begin
  if not app.has_role('expert') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_provider from public.providers where owner_user_id = auth.uid() for update;
  if not found then
    raise exception 'no provider profile' using errcode = '42501';
  end if;
  if v_provider.status <> 'draft' then
    raise exception 'profile cannot be submitted from status %', v_provider.status using errcode = '55000';
  end if;

  v_missing := public.provider_profile_checklist(v_provider.id);
  if cardinality(v_missing) > 0 then
    return v_missing;
  end if;

  update public.providers set status = 'pending_review', submitted_at = now() where id = v_provider.id;
  update public.review_requests set status = 'superseded'
   where target_type = 'provider' and target_id = v_provider.id and status = 'pending';
  insert into public.review_requests (target_type, target_id, provider_id, kind, flags)
  values ('provider', v_provider.id, v_provider.id, 'initial',
          app_private.detect_review_flags(app_private.provider_text(v_provider.id)));

  perform app_private.write_audit('provider.submitted', 'provider', v_provider.id::text);
  perform app_private.enqueue_event('provider.submitted', 'provider', v_provider.id);
  return '{}';
end;
$$;

-- pause | resume | archive | restore
create function public.listings_change_status(p_listing_id uuid, p_action text)
returns public.listing_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.listing_status;
  v_next public.listing_status;
begin
  if not app.owns_listing(p_listing_id) or not app.has_role('expert') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select status into v_status from public.service_listings where id = p_listing_id for update;

  v_next := case
    when p_action = 'pause' and v_status = 'published' then 'paused'
    when p_action = 'resume' and v_status = 'paused' then 'published'
    when p_action = 'archive' and v_status in ('draft', 'rejected', 'published', 'paused') then 'archived'
    when p_action = 'restore' and v_status = 'archived' then 'draft'
    else null
  end::public.listing_status;

  if v_next is null then
    raise exception 'cannot % a listing that is %', p_action, v_status using errcode = '55000';
  end if;

  update public.service_listings
     set status = v_next,
         published_at = case when v_next = 'published' then coalesce(published_at, now()) else published_at end
   where id = p_listing_id;
  if v_next = 'archived' then
    update public.review_requests set status = 'superseded'
     where target_type = 'listing' and target_id = p_listing_id and status = 'pending';
  end if;
  perform app_private.write_audit('listing.' || p_action, 'listing', p_listing_id::text,
    jsonb_build_object('status', v_status), jsonb_build_object('status', v_next));
  return v_next;
end;
$$;

create function public.providers_set_handle(p_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text := lower(btrim(p_handle));
begin
  if not app.has_role('expert') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_handle !~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$' or v_handle ~ '--' then
    raise exception 'invalid handle' using errcode = '22023';
  end if;
  if v_handle = any (array['admin', 'api', 'app', 'auth', 'dashboard', 'experts', 'services', 'categories', 'search',
      'login', 'register', 'settings', 'support', 'help', 'greco', 'legal', 'about', 'new', 'edit', 'me', 'www',
      'mail', 'static', 'assets', 'staff', 'moderator', 'security', 'billing', 'payments', 'official']) then
    raise exception 'reserved handle' using errcode = '22023';
  end if;
  if exists (select 1 from public.providers where handle = v_handle and owner_user_id <> auth.uid()) then
    raise exception 'handle taken' using errcode = '23505';
  end if;
  update public.providers set handle = v_handle where owner_user_id = auth.uid();
end;
$$;

create function public.providers_set_avatar(p_file_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_role('expert') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_file_id is not null and not exists (
    select 1 from public.file_objects f
     where f.id = p_file_id and f.owner_user_id = auth.uid() and f.purpose = 'avatar' and f.deleted_at is null
  ) then
    raise exception 'invalid file' using errcode = '42501';
  end if;
  update public.providers set avatar_file_id = p_file_id where owner_user_id = auth.uid();
end;
$$;

create function public.client_complete_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_role('client') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.client_profiles
     set onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where user_id = auth.uid() and account_type is not null;
  if not found then
    raise exception 'choose an account type first' using errcode = '23514';
  end if;
end;
$$;

-- Experts can suggest taxonomy terms; moderators approve or merge them.
create function public.suggest_taxonomy_term(p_kind public.term_kind, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_slug text := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9.+]+', '-', 'g'));
  v_id uuid;
begin
  if not app.has_role('expert') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 60 or v_slug = '' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if (select count(*) from public.taxonomy_terms where suggested_by = auth.uid() and status = 'pending') >= 20 then
    raise exception 'too many pending suggestions' using errcode = '54000';
  end if;

  select id into v_id from public.taxonomy_terms where kind = p_kind and slug = v_slug;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.taxonomy_terms (kind, slug, status, suggested_by) values (p_kind, v_slug, 'pending', auth.uid())
  returning id into v_id;
  insert into public.taxonomy_term_translations (term_id, locale, name) values (v_id, 'en', v_name);
  return v_id;
end;
$$;

-- Public media (avatars, listing and portfolio images) --------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-media', 'public-media', true, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- Uploads go to "<user id>/<purpose>/<uuid>.webp"; only the server uploads (after re-encoding).
create policy public_media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy public_media_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

create function public.register_uploaded_file(
  p_path text,
  p_purpose public.file_purpose,
  p_mime text,
  p_size bigint,
  p_sha256 text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_purpose not in ('avatar', 'listing_media', 'portfolio_media') then
    raise exception 'unsupported purpose' using errcode = '22023';
  end if;
  if split_part(p_path, '/', 1) <> auth.uid()::text or split_part(p_path, '/', 2) <> p_purpose::text then
    raise exception 'path does not belong to this user' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'public-media' and o.name = p_path) then
    raise exception 'file not uploaded' using errcode = '22023';
  end if;

  -- Images are re-encoded by the server before upload (metadata stripped), hence "skipped".
  insert into public.file_objects (bucket, path, owner_user_id, purpose, mime_type, size_bytes, sha256, scan_status)
  values ('public-media', p_path, auth.uid(), p_purpose, p_mime, p_size, p_sha256, 'skipped')
  returning id into v_id;
  return v_id;
end;
$$;

-- Grants and RLS -------------------------------------------------------------------------------
alter table public.service_listings enable row level security;
alter table public.service_listing_categories enable row level security;
alter table public.service_listing_terms enable row level security;
alter table public.service_packages enable row level security;
alter table public.service_deliverables enable row level security;
alter table public.service_addons enable row level security;
alter table public.service_requirements enable row level security;
alter table public.service_faqs enable row level security;
alter table public.service_media enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.portfolio_item_terms enable row level security;
alter table public.portfolio_item_media enable row level security;
alter table public.saved_providers enable row level security;
alter table public.saved_services enable row level security;
alter table public.saved_categories enable row level security;
alter table public.review_requests enable row level security;
alter table public.moderation_actions enable row level security;

-- Listings: owners write content columns; status changes only through the functions above.
grant select on public.service_listings to anon, authenticated;
grant insert (id, provider_id, slug, title, summary, description, primary_category_id, pricing_model, currency,
  fixed_price_minor, hourly_rate_minor, min_hours, quote_from_minor, base_delivery_days, payment_model,
  deposit_bps, balance_trigger, revisions_included, revision_policy, requirements_intro, source_locale)
  on public.service_listings to authenticated;
grant update (slug, title, summary, description, primary_category_id, pricing_model, currency,
  fixed_price_minor, hourly_rate_minor, min_hours, quote_from_minor, base_delivery_days, payment_model,
  deposit_bps, balance_trigger, revisions_included, revision_policy, requirements_intro, source_locale)
  on public.service_listings to authenticated;
grant delete on public.service_listings to authenticated;

create policy service_listings_read on public.service_listings for select to anon, authenticated
  using ((select app.listing_is_visible(id)));
create policy service_listings_insert_own on public.service_listings for insert to authenticated
  with check (
    (select app.owns_provider(provider_id))
    and (select app.has_role('expert'))
    and exists (select 1 from public.providers p where p.id = provider_id and p.status not in ('suspended', 'deactivated'))
  );
create policy service_listings_update_own on public.service_listings for update to authenticated
  using ((select app.listing_is_editable(id)))
  with check ((select app.owns_provider(provider_id)));
create policy service_listings_delete_draft on public.service_listings for delete to authenticated
  using ((select app.owns_listing(id)) and status = 'draft' and published_at is null);

-- Listing children: visible with the listing, editable with the listing.
do $$
declare
  t text;
begin
  foreach t in array array['service_listing_categories', 'service_listing_terms', 'service_packages',
    'service_deliverables', 'service_addons', 'service_requirements', 'service_faqs', 'service_media']
  loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using ((select app.listing_is_visible(listing_id)))', t || '_read', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select app.listing_is_editable(listing_id)))', t || '_delete_own', t);
  end loop;
end;
$$;

create policy service_listing_categories_insert_own on public.service_listing_categories for insert to authenticated
  with check ((select app.listing_is_editable(listing_id))
    and exists (select 1 from public.categories c where c.id = category_id and c.is_active));
create policy service_listing_categories_update_own on public.service_listing_categories for update to authenticated
  using ((select app.listing_is_editable(listing_id))) with check ((select app.listing_is_editable(listing_id)));
create policy service_listing_terms_insert_own on public.service_listing_terms for insert to authenticated
  with check ((select app.listing_is_editable(listing_id))
    and exists (select 1 from public.taxonomy_terms t where t.id = term_id and t.status = 'active'));
create policy service_listing_terms_update_own on public.service_listing_terms for update to authenticated
  using ((select app.listing_is_editable(listing_id))) with check ((select app.listing_is_editable(listing_id)));
create policy service_media_insert_own on public.service_media for insert to authenticated
  with check ((select app.listing_is_editable(listing_id))
    and exists (select 1 from public.file_objects f where f.id = file_id and f.owner_user_id = (select auth.uid())
                and f.purpose = 'listing_media' and f.deleted_at is null));
create policy service_media_update_own on public.service_media for update to authenticated
  using ((select app.listing_is_editable(listing_id))) with check ((select app.listing_is_editable(listing_id)));

do $$
declare
  t text;
begin
  foreach t in array array['service_packages', 'service_deliverables', 'service_addons', 'service_requirements', 'service_faqs']
  loop
    execute format('create policy %I on public.%I for insert to authenticated with check ((select app.listing_is_editable(listing_id)))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select app.listing_is_editable(listing_id))) with check ((select app.listing_is_editable(listing_id)))', t || '_update_own', t);
  end loop;
end;
$$;

-- Deliverables must belong to a package of the same listing.
create function app_private.deliverable_package_matches()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.package_id is not null and not exists (
    select 1 from public.service_packages p where p.id = new.package_id and p.listing_id = new.listing_id
  ) then
    raise exception 'package belongs to another listing' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger service_deliverables_package_matches before insert or update on public.service_deliverables
  for each row execute function app_private.deliverable_package_matches();

-- Portfolio: owners manage items; provenance is never writable by them.
grant select on public.portfolio_items to anon, authenticated;
grant insert (id, provider_id, title, summary, problem, solution, results, role, client_display_name, industry_term_id,
  project_date, external_url, status, sort_order) on public.portfolio_items to authenticated;
grant update (title, summary, problem, solution, results, role, client_display_name, industry_term_id,
  project_date, external_url, status, sort_order) on public.portfolio_items to authenticated;
grant delete on public.portfolio_items to authenticated;
create policy portfolio_items_read on public.portfolio_items for select to anon, authenticated
  using ((select app.portfolio_item_is_visible(id)));
create policy portfolio_items_insert_own on public.portfolio_items for insert to authenticated
  with check ((select app.owns_provider(provider_id)) and (select app.has_role('expert')));
create policy portfolio_items_update_own on public.portfolio_items for update to authenticated
  using ((select app.owns_provider(provider_id)) and provenance = 'self_reported')
  with check ((select app.owns_provider(provider_id)));
create policy portfolio_items_delete_own on public.portfolio_items for delete to authenticated
  using ((select app.owns_provider(provider_id)) and provenance = 'self_reported');

create function app.owns_portfolio_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.portfolio_items i join public.providers p on p.id = i.provider_id
     where i.id = p_item_id and p.owner_user_id = auth.uid() and i.provenance = 'self_reported'
  );
$$;
revoke all on function app.owns_portfolio_item(uuid) from public;
grant execute on function app.owns_portfolio_item(uuid) to anon, authenticated, service_role;

grant select on public.portfolio_item_terms, public.portfolio_item_media to anon, authenticated;
grant insert, delete on public.portfolio_item_terms to authenticated;
grant insert (item_id, file_id, caption, sort_order), update (caption, sort_order), delete
  on public.portfolio_item_media to authenticated;
create policy portfolio_item_terms_read on public.portfolio_item_terms for select to anon, authenticated
  using ((select app.portfolio_item_is_visible(item_id)));
create policy portfolio_item_terms_insert_own on public.portfolio_item_terms for insert to authenticated
  with check ((select app.owns_portfolio_item(item_id))
    and exists (select 1 from public.taxonomy_terms t where t.id = term_id and t.status = 'active'));
create policy portfolio_item_terms_delete_own on public.portfolio_item_terms for delete to authenticated
  using ((select app.owns_portfolio_item(item_id)));
create policy portfolio_item_media_read on public.portfolio_item_media for select to anon, authenticated
  using ((select app.portfolio_item_is_visible(item_id)));
create policy portfolio_item_media_insert_own on public.portfolio_item_media for insert to authenticated
  with check ((select app.owns_portfolio_item(item_id))
    and exists (select 1 from public.file_objects f where f.id = file_id and f.owner_user_id = (select auth.uid())
                and f.purpose = 'portfolio_media' and f.deleted_at is null));
create policy portfolio_item_media_update_own on public.portfolio_item_media for update to authenticated
  using ((select app.owns_portfolio_item(item_id))) with check ((select app.owns_portfolio_item(item_id)));
create policy portfolio_item_media_delete_own on public.portfolio_item_media for delete to authenticated
  using ((select app.owns_portfolio_item(item_id)));

-- Saved items (Class A): private to their owner; only visible targets can be saved.
grant select, delete on public.saved_providers, public.saved_services, public.saved_categories to authenticated;
grant insert (user_id, provider_id) on public.saved_providers to authenticated;
grant insert (user_id, listing_id) on public.saved_services to authenticated;
grant insert (user_id, category_id) on public.saved_categories to authenticated;
create policy saved_providers_own on public.saved_providers for select to authenticated using (user_id = (select auth.uid()));
create policy saved_providers_delete_own on public.saved_providers for delete to authenticated using (user_id = (select auth.uid()));
create policy saved_providers_insert_own on public.saved_providers for insert to authenticated
  with check (user_id = (select auth.uid()) and (select app.provider_is_visible(provider_id)));
create policy saved_services_own on public.saved_services for select to authenticated using (user_id = (select auth.uid()));
create policy saved_services_delete_own on public.saved_services for delete to authenticated using (user_id = (select auth.uid()));
create policy saved_services_insert_own on public.saved_services for insert to authenticated
  with check (user_id = (select auth.uid()) and (select app.listing_is_visible(listing_id)));
create policy saved_categories_own on public.saved_categories for select to authenticated using (user_id = (select auth.uid()));
create policy saved_categories_delete_own on public.saved_categories for delete to authenticated using (user_id = (select auth.uid()));
create policy saved_categories_insert_own on public.saved_categories for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.categories c where c.id = category_id and c.is_active));

-- Moderation records: the affected expert and staff can read; nobody writes directly.
grant select on public.review_requests, public.moderation_actions to authenticated;
create policy review_requests_read on public.review_requests for select to authenticated
  using ((select app.owns_provider(provider_id)) or (select app.is_staff(array['super_admin', 'admin', 'moderator']::public.staff_role[])));
create policy moderation_actions_read on public.moderation_actions for select to authenticated
  using ((provider_id is not null and (select app.owns_provider(provider_id)))
         or (select app.is_staff(array['super_admin', 'admin', 'moderator']::public.staff_role[])));

-- Public media metadata is public (paths are needed to show images).
create policy file_objects_read_public_media on public.file_objects for select to anon, authenticated
  using (bucket = 'public-media' and deleted_at is null);
grant select (id, bucket, path, mime_type, purpose) on public.file_objects to anon;

-- Function privileges --------------------------------------------------------------------------
revoke all on function public.provider_profile_checklist(uuid) from public, anon, authenticated;
revoke all on function public.listing_checklist(uuid) from public, anon, authenticated;
revoke all on function public.listings_submit_for_review(uuid) from public, anon, authenticated;
revoke all on function public.providers_submit_for_review() from public, anon, authenticated;
revoke all on function public.listings_change_status(uuid, text) from public, anon, authenticated;
revoke all on function public.providers_set_handle(text) from public, anon, authenticated;
revoke all on function public.providers_set_avatar(uuid) from public, anon, authenticated;
revoke all on function public.client_complete_onboarding() from public, anon, authenticated;
revoke all on function public.suggest_taxonomy_term(public.term_kind, text) from public, anon, authenticated;
revoke all on function public.register_uploaded_file(text, public.file_purpose, text, bigint, text) from public, anon, authenticated;

grant execute on function public.provider_profile_checklist(uuid) to authenticated;
grant execute on function public.listing_checklist(uuid) to authenticated;
grant execute on function public.listings_submit_for_review(uuid) to authenticated;
grant execute on function public.providers_submit_for_review() to authenticated;
grant execute on function public.listings_change_status(uuid, text) to authenticated;
grant execute on function public.providers_set_handle(text) to authenticated;
grant execute on function public.providers_set_avatar(uuid) to authenticated;
grant execute on function public.client_complete_onboarding() to authenticated;
grant execute on function public.suggest_taxonomy_term(public.term_kind, text) to authenticated;
grant execute on function public.register_uploaded_file(text, public.file_purpose, text, bigint, text) to authenticated;

revoke all on all functions in schema app_private from public, anon, authenticated;
