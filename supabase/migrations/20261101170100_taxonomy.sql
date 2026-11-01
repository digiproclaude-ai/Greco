-- Categories (hierarchical, admin-managed) and the controlled taxonomy of skills,
-- technologies, industries and use cases. See DATABASE_SCHEMA.md §5.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  slug extensions.citext not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  path extensions.ltree not null,
  depth smallint generated always as (extensions.nlevel(path)) stored,
  icon_key text check (icon_key ~ '^[a-z0-9-]{1,40}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_sibling_slug_key unique nulls not distinct (parent_id, slug),
  constraint categories_path_key unique (path)
);
create index categories_path_gist on public.categories using gist (path);
create index categories_parent_idx on public.categories (parent_id, sort_order);

create trigger categories_set_updated_at before update on public.categories
  for each row execute function extensions.moddatetime(updated_at);

-- Keep path in sync with slug and parent; block cycles.
create function app_private.categories_set_path()
returns trigger
language plpgsql
set search_path = extensions, pg_temp
as $$
declare
  v_label extensions.ltree := extensions.text2ltree(replace(lower(new.slug::text), '-', '_'));
  v_parent_path extensions.ltree;
begin
  if new.parent_id is null then
    new.path := v_label;
  else
    select c.path into v_parent_path from public.categories c where c.id = new.parent_id;
    if v_parent_path is null then
      raise exception 'parent category % does not exist', new.parent_id;
    end if;
    if tg_op = 'UPDATE' and (new.parent_id = new.id or v_parent_path <@ old.path) then
      raise exception 'a category cannot be moved under itself or one of its descendants'
        using errcode = 'check_violation';
    end if;
    new.path := v_parent_path || v_label;
  end if;
  return new;
end;
$$;

create trigger categories_set_path
  before insert or update of slug, parent_id on public.categories
  for each row execute function app_private.categories_set_path();

create function app_private.categories_cascade_path()
returns trigger
language plpgsql
set search_path = extensions, pg_temp
as $$
begin
  if new.path is distinct from old.path then
    update public.categories c
       set path = new.path || extensions.subpath(c.path, extensions.nlevel(old.path))
     where c.path <@ old.path and c.id <> new.id;
  end if;
  return null;
end;
$$;

-- Column-specific triggers only see columns in the UPDATE's SET list (not changes made by
-- BEFORE triggers), so fire on slug/parent changes and compare the resulting paths.
create trigger categories_cascade_path
  after update of slug, parent_id on public.categories
  for each row when (new.path is distinct from old.path)
  execute function app_private.categories_cascade_path();

create table public.category_translations (
  category_id uuid not null references public.categories (id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  name text not null check (char_length(name) between 1 and 80),
  short_description text check (char_length(short_description) <= 160),
  description text check (char_length(description) <= 2000),
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 170),
  primary key (category_id, locale)
);

-- Every category needs an English name (checked at commit, so both rows can be inserted in one transaction).
create function app_private.categories_require_english()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_category uuid;
begin
  if tg_table_name = 'categories' then
    v_category := new.id;
  else
    v_category := old.category_id;
  end if;

  if exists (select 1 from public.categories c where c.id = v_category)
     and not exists (select 1 from public.category_translations t where t.category_id = v_category and t.locale = 'en') then
    raise exception 'category % needs an English (en) translation', v_category
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger categories_require_english
  after insert on public.categories
  deferrable initially deferred
  for each row execute function app_private.categories_require_english();

create constraint trigger category_translations_keep_english
  after delete or update on public.category_translations
  deferrable initially deferred
  for each row execute function app_private.categories_require_english();

create table public.category_relations (
  category_id uuid not null references public.categories (id) on delete cascade,
  related_category_id uuid not null references public.categories (id) on delete cascade,
  relation_kind text not null default 'related' check (relation_kind in ('related', 'see_also')),
  sort_order integer not null default 0,
  primary key (category_id, related_category_id),
  check (category_id <> related_category_id)
);
create index category_relations_related_idx on public.category_relations (related_category_id);

create table public.taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  kind public.term_kind not null,
  slug extensions.citext not null check (slug ~ '^[a-z0-9]+([-.+][a-z0-9]+)*$' and char_length(slug) <= 60),
  status public.term_status not null default 'active',
  merged_into_id uuid references public.taxonomy_terms (id) on delete restrict,
  suggested_by uuid, -- references public.profiles, added with the identity migration
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug),
  check ((status = 'merged') = (merged_into_id is not null))
);
create index taxonomy_terms_merged_into_idx on public.taxonomy_terms (merged_into_id) where merged_into_id is not null;

create trigger taxonomy_terms_set_updated_at before update on public.taxonomy_terms
  for each row execute function extensions.moddatetime(updated_at);

create table public.taxonomy_term_translations (
  term_id uuid not null references public.taxonomy_terms (id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  primary key (term_id, locale)
);

create table public.taxonomy_term_aliases (
  term_id uuid not null references public.taxonomy_terms (id) on delete cascade,
  alias extensions.citext not null check (char_length(alias) between 1 and 80),
  locale text not null default 'en' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  primary key (alias, locale)
);
create index taxonomy_term_aliases_term_idx on public.taxonomy_term_aliases (term_id);

create table public.category_terms (
  category_id uuid not null references public.categories (id) on delete cascade,
  term_id uuid not null references public.taxonomy_terms (id) on delete cascade,
  weight smallint not null default 1 check (weight between 1 and 10),
  primary key (category_id, term_id)
);
create index category_terms_term_idx on public.category_terms (term_id);
