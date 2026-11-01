-- Greco foundation: schemas, extensions, shared enums, audit log and outbox.
-- See DATABASE_SCHEMA.md §1 (conventions) and §19 (audit, outbox).

create schema if not exists extensions;
create extension if not exists citext with schema extensions;
create extension if not exists ltree with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists moddatetime with schema extensions;

-- app: authorization helpers used by RLS policies (not exposed through the Data API).
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

-- app_private: internal tables (audit, outbox, ...). Never reachable by anon/authenticated.
create schema if not exists app_private;
revoke all on schema app_private from public;
revoke all on schema app_private from anon, authenticated;
grant usage on schema app_private to service_role;

-- Shared enums ---------------------------------------------------------------
create type public.marketplace_role as enum ('client', 'expert');
create type public.role_status as enum ('active', 'suspended');
create type public.staff_role as enum ('super_admin', 'admin', 'moderator', 'support', 'finance');
create type public.account_status as enum ('active', 'suspended', 'deactivated', 'pending_deletion', 'deleted');
create type public.client_account_type as enum ('individual', 'business');
create type public.company_size as enum ('1', '2-10', '11-50', '51-200', '201-1000', '1000+');
create type public.provider_type as enum ('individual', 'agency');
create type public.provider_status as enum ('draft', 'pending_review', 'active', 'suspended', 'deactivated');
create type public.experience_level as enum ('emerging', 'established', 'expert');
create type public.availability_status as enum ('available', 'limited', 'unavailable');
create type public.team_size as enum ('2-5', '6-10', '11-25', '26-50', '51-200', '200+');
create type public.language_proficiency as enum ('basic', 'conversational', 'fluent', 'native');
create type public.link_kind as enum ('github', 'linkedin', 'huggingface', 'kaggle', 'website', 'x', 'youtube', 'scholar', 'other');
create type public.legal_doc_kind as enum ('terms', 'privacy', 'provider_agreement', 'refund_policy', 'cookie_policy', 'acceptable_use');
create type public.term_kind as enum ('skill', 'technology', 'tool', 'framework', 'model', 'platform', 'industry', 'use_case');
create type public.term_status as enum ('active', 'pending', 'merged', 'retired');
create type public.file_purpose as enum ('avatar', 'listing_media', 'portfolio_media', 'message_attachment', 'project_attachment', 'delivery', 'verification_evidence', 'export');
create type public.scan_status as enum ('pending', 'clean', 'infected', 'error', 'skipped');

-- Audit log (append-only) ----------------------------------------------------
create table app_private.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('user', 'staff', 'system', 'psp')),
  action text not null check (action ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  target_type text not null,
  target_id text,
  before jsonb,
  after jsonb,
  reason text,
  request_id text
);
create index audit_logs_target_idx on app_private.audit_logs (target_type, target_id, occurred_at desc);
create index audit_logs_actor_idx on app_private.audit_logs (actor_user_id, occurred_at desc);

create function app_private.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_schema || '.' || tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_logs_append_only
  before update or delete on app_private.audit_logs
  for each row execute function app_private.prevent_mutation();

create function app_private.request_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id';
$$;

create function app_private.write_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_kind text;
begin
  if v_actor is null then
    v_kind := 'system';
  elsif exists (select 1 from public.staff_roles s where s.user_id = v_actor and s.revoked_at is null) then
    v_kind := 'staff';
  else
    v_kind := 'user';
  end if;

  insert into app_private.audit_logs (actor_user_id, actor_kind, action, target_type, target_id, before, after, reason, request_id)
  values (v_actor, v_kind, p_action, p_target_type, p_target_id, p_before, p_after, p_reason, app_private.request_id());
end;
$$;

-- Outbox: side effects written in the same transaction as the state change --
create table app_private.outbox_events (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  aggregate_type text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  attempts integer not null default 0,
  processed_at timestamptz,
  last_error text
);
create index outbox_events_pending_idx on app_private.outbox_events (available_at)
  where processed_at is null;

create function app_private.enqueue_event(
  p_topic text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into app_private.outbox_events (topic, aggregate_type, aggregate_id, payload)
  values (p_topic, p_aggregate_type, p_aggregate_id, coalesce(p_payload, '{}'::jsonb));
$$;

revoke all on all tables in schema app_private from public, anon, authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;
