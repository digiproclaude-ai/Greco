-- Accounts, roles, legal acceptance, files and client/provider profiles.
-- See ARCHITECTURE.md §8 and DATABASE_SCHEMA.md §3, §4, §19.

create table public.countries (
  code char(2) primary key check (code ~ '^[A-Z]{2}$'),
  can_register boolean not null default true,
  can_buy boolean not null default true,
  can_sell boolean not null default true,
  default_currency char(3) check (default_currency ~ '^[A-Z]{3}$'),
  restriction_note text,
  updated_at timestamptz not null default now()
);
create trigger countries_set_updated_at before update on public.countries
  for each row execute function extensions.moddatetime(updated_at);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  display_name text check (char_length(display_name) between 2 and 80),
  avatar_file_id uuid,
  country_code char(2) references public.countries (code),
  locale text not null default 'en' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  active_role public.marketplace_role not null,
  account_status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index profiles_country_idx on public.profiles (country_code);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function extensions.moddatetime(updated_at);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.marketplace_role not null,
  status public.role_status not null default 'active',
  enabled_at timestamptz not null default now(),
  suspended_at timestamptz,
  suspension_reason text,
  primary key (user_id, role),
  check ((status = 'suspended') = (suspended_at is not null))
);

create table public.staff_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.staff_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, role)
);
create index staff_roles_active_idx on public.staff_roles (user_id) where revoked_at is null;

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind public.legal_doc_kind not null,
  version text not null check (char_length(version) between 1 and 32),
  locale text not null default 'en' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  url_path text not null check (url_path ~ '^/[a-z0-9/-]+$'),
  content_sha256 text check (content_sha256 ~ '^[a-f0-9]{64}$'),
  is_draft boolean not null default true,
  requires_acceptance boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, version, locale)
);

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_id uuid not null references public.legal_documents (id) on delete restrict,
  context text not null check (context in ('registration', 'reacceptance', 'checkout', 'provider_onboarding')),
  accepted_at timestamptz not null default now(),
  unique (user_id, document_id)
);
create index legal_acceptances_document_idx on public.legal_acceptances (document_id);

create table public.file_objects (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('public-media', 'attachments', 'deliveries', 'verification', 'exports')),
  path text not null unique check (char_length(path) <= 512),
  owner_user_id uuid not null references public.profiles (id) on delete restrict,
  purpose public.file_purpose not null,
  mime_type text not null check (mime_type ~ '^[a-z]+/[a-z0-9.+-]+$'),
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text check (sha256 ~ '^[a-f0-9]{64}$'),
  scan_status public.scan_status not null default 'pending',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index file_objects_owner_idx on public.file_objects (owner_user_id, created_at desc);

alter table public.profiles
  add constraint profiles_avatar_file_fk foreign key (avatar_file_id) references public.file_objects (id) on delete set null;

alter table public.taxonomy_terms
  add constraint taxonomy_terms_suggested_by_fk foreign key (suggested_by) references public.profiles (id) on delete set null;

create table public.client_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  account_type public.client_account_type,
  business_name text check (char_length(business_name) between 1 and 160),
  industry_term_id uuid references public.taxonomy_terms (id) on delete set null,
  company_size public.company_size,
  website_url text check (website_url ~* '^https://[^\s]+$' and char_length(website_url) <= 300),
  purpose text check (char_length(purpose) <= 500),
  challenges text check (char_length(challenges) <= 2000),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_profiles_industry_idx on public.client_profiles (industry_term_id);
create trigger client_profiles_set_updated_at before update on public.client_profiles
  for each row execute function extensions.moddatetime(updated_at);

-- Provider = expert or agency. Everything provider-side references providers.id (D-06),
-- so team seats can be added later by relaxing owner_user_id's uniqueness.
create table public.providers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.profiles (id) on delete restrict,
  provider_type public.provider_type not null default 'individual',
  handle extensions.citext not null unique check (handle ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),
  display_name text not null check (char_length(display_name) between 2 and 80),
  headline text check (char_length(headline) <= 120),
  bio text check (char_length(bio) <= 5000),
  avatar_file_id uuid references public.file_objects (id) on delete set null,
  cover_file_id uuid references public.file_objects (id) on delete set null,
  country_code char(2) references public.countries (code),
  city text check (char_length(city) <= 80),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  experience_level public.experience_level,
  years_experience smallint check (years_experience between 0 and 60),
  indicative_hourly_rate_minor bigint check (indicative_hourly_rate_minor >= 0),
  rate_currency char(3) check (rate_currency ~ '^[A-Z]{3}$'),
  availability public.availability_status not null default 'available',
  availability_note text check (char_length(availability_note) <= 200),
  website_url text check (website_url ~* '^https://[^\s]+$' and char_length(website_url) <= 300),
  status public.provider_status not null default 'draft',
  profile_completeness smallint not null default 0 check (profile_completeness between 0 and 100),
  source_locale text not null default 'en' check (source_locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((indicative_hourly_rate_minor is null) = (rate_currency is null))
);
create index providers_status_idx on public.providers (status);
create index providers_country_idx on public.providers (country_code);
create index providers_avatar_idx on public.providers (avatar_file_id) where avatar_file_id is not null;
create index providers_cover_idx on public.providers (cover_file_id) where cover_file_id is not null;
create trigger providers_set_updated_at before update on public.providers
  for each row execute function extensions.moddatetime(updated_at);

create table public.provider_agency_details (
  provider_id uuid primary key references public.providers (id) on delete cascade,
  founded_year smallint check (founded_year between 1950 and 2100),
  team_size_range public.team_size,
  office_locations text[] check (cardinality(office_locations) <= 10),
  legal_name text check (char_length(legal_name) <= 160),
  registration_number text check (char_length(registration_number) <= 64),
  updated_at timestamptz not null default now()
);
create trigger provider_agency_details_set_updated_at before update on public.provider_agency_details
  for each row execute function extensions.moddatetime(updated_at);

create table public.provider_languages (
  provider_id uuid not null references public.providers (id) on delete cascade,
  language_code text not null check (language_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  proficiency public.language_proficiency not null,
  primary key (provider_id, language_code)
);

create table public.provider_links (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  kind public.link_kind not null,
  url text not null check (url ~* '^https://[^\s]+$' and char_length(url) <= 300),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider_id, url)
);

create table public.provider_terms (
  provider_id uuid not null references public.providers (id) on delete cascade,
  term_id uuid not null references public.taxonomy_terms (id) on delete cascade,
  years smallint check (years between 0 and 60),
  is_featured boolean not null default false,
  primary key (provider_id, term_id)
);
create index provider_terms_term_idx on public.provider_terms (term_id);
