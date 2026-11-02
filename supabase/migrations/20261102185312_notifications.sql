-- Phase 4 foundations: notifications (in-app feed, preferences, email hand-off), saved
-- searches, content reports and realtime authorization. See ARCHITECTURE.md §11-12 and
-- DATABASE_SCHEMA.md §16-17.

-- Realtime ------------------------------------------------------------------------------------
-- Best-effort broadcast to a private channel; a failure never undoes the state change.
create function app_private.broadcast(p_topic text, p_event text, p_payload jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(coalesce(p_payload, '{}'::jsonb), p_event, p_topic, true);
exception when others then
  null;
end;
$$;

-- Who may join which private channel. Conversation topics are added with messaging.
create function app.can_access_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_topic ~ '^user:[0-9a-f-]{36}$' then substring(p_topic from 6)::uuid = auth.uid()
    else false
  end;
$$;
revoke all on function app.can_access_topic(text) from public;
grant execute on function app.can_access_topic(text) to authenticated;

create policy greco_private_channels_read on realtime.messages for select to authenticated
  using ((select app.can_access_topic((select realtime.topic()))));

-- Notifications ---------------------------------------------------------------------------------
create table public.notification_types (
  key text primary key check (key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  category text not null check (category in ('projects', 'messages', 'account', 'saved')),
  default_channels text[] not null default '{in_app}' check (default_channels <@ array['in_app', 'email']::text[]),
  user_configurable boolean not null default true
);

insert into public.notification_types (key, category, default_channels, user_configurable) values
  ('proposal.received', 'projects', '{in_app}', true),
  ('proposal.shortlisted', 'projects', '{in_app,email}', true),
  ('proposal.declined', 'projects', '{in_app}', true),
  ('proposal.withdrawn', 'projects', '{in_app}', true),
  ('proposal.expired', 'projects', '{in_app}', true),
  ('project.invited', 'projects', '{in_app,email}', true),
  ('invitation.declined', 'projects', '{in_app}', true),
  ('message.received', 'messages', '{in_app}', true),
  ('messages.unread_digest', 'messages', '{email}', true),
  ('moderation.decided', 'account', '{in_app,email}', false),
  ('content.removed', 'account', '{in_app,email}', false),
  ('saved_search.match', 'saved', '{in_app}', true);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type_key text not null references public.notification_types (key),
  actor_user_id uuid references public.profiles (id) on delete set null,
  entity_type text not null check (char_length(entity_type) <= 40),
  entity_id uuid,
  group_key text check (char_length(group_key) <= 120),
  params jsonb not null default '{}'::jsonb,
  count integer not null default 1,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create unique index notifications_group_unread on public.notifications (user_id, group_key)
  where read_at is null and group_key is not null;
create index notifications_actor_idx on public.notifications (actor_user_id) where actor_user_id is not null;
create index notifications_type_idx on public.notifications (type_key);

create table public.notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  type_key text not null references public.notification_types (key) on delete cascade,
  channel text not null check (channel in ('in_app', 'email')),
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, type_key, channel)
);
create index notification_preferences_type_idx on public.notification_preferences (type_key);

-- One delivery attempt record per notification and channel (written by the job runner).
create table app_private.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel text not null check (channel in ('email')),
  status text not null check (status in ('sent', 'skipped', 'failed')),
  provider_ref text,
  error text,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);

create function app_private.notification_enabled(p_user uuid, p_type text, p_channel text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select np.enabled
       from public.notification_preferences np
       join public.notification_types nt on nt.key = np.type_key and nt.user_configurable
      where np.user_id = p_user and np.type_key = p_type and np.channel = p_channel),
    (select p_channel = any (nt.default_channels) from public.notification_types nt where nt.key = p_type),
    false
  );
$$;

/*
 * Create (or bump a grouped) in-app notification in the same transaction as the event, hand it
 * to the job runner for email, and ping the user's private channel. Nobody is notified about
 * their own actions. Returns the notification id, or null when nothing was created.
 */
create function app_private.notify(
  p_user uuid,
  p_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_params jsonb default '{}'::jsonb,
  p_group_key text default null,
  p_actor uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_in_app boolean;
begin
  if p_user is null or p_user = p_actor then
    return null;
  end if;
  v_in_app := app_private.notification_enabled(p_user, p_type, 'in_app');
  if not v_in_app and not app_private.notification_enabled(p_user, p_type, 'email') then
    return null;
  end if;

  if p_group_key is not null then
    update public.notifications
       set count = count + 1, params = params || coalesce(p_params, '{}'::jsonb), created_at = now(), actor_user_id = p_actor
     where user_id = p_user and group_key = p_group_key and read_at is null
    returning id into v_id;
  end if;

  if v_id is null then
    insert into public.notifications (user_id, type_key, actor_user_id, entity_type, entity_id, group_key, params, read_at)
    values (p_user, p_type, p_actor, p_entity_type, p_entity_id, p_group_key, coalesce(p_params, '{}'::jsonb),
            case when v_in_app then null else now() end)
    returning id into v_id;
    perform app_private.enqueue_event('notification.created', 'notification', v_id,
      jsonb_build_object('type', p_type, 'user_id', p_user));
  end if;

  perform app_private.broadcast('user:' || p_user::text, 'notification', jsonb_build_object('type', p_type));
  return v_id;
end;
$$;

-- Counters for the header badge (messages are added with messaging).
create function public.my_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'notifications', (select count(*) from public.notifications n where n.user_id = auth.uid() and n.read_at is null),
    'messages', 0
  );
$$;

-- Saved searches ---------------------------------------------------------------------------------
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('services', 'experts')),
  name text not null check (char_length(name) between 1 and 80),
  query jsonb not null default '{}'::jsonb check (jsonb_typeof(query) = 'object' and char_length(query::text) <= 2000),
  alerts_enabled boolean not null default false,
  last_alerted_at timestamptz,
  created_at timestamptz not null default now()
);
create index saved_searches_user_idx on public.saved_searches (user_id, created_at desc);
create index saved_searches_alerts_idx on public.saved_searches (last_alerted_at) where alerts_enabled;
create trigger saved_searches_limit after insert on public.saved_searches
  for each row execute function app_private.enforce_child_limit('user_id', '20');

-- Trust and safety -------------------------------------------------------------------------------
create type public.report_reason as enum (
  'spam', 'scam_or_fraud', 'off_platform', 'harassment', 'inappropriate', 'intellectual_property',
  'misleading', 'prohibited_service', 'other'
);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('message', 'user', 'provider', 'listing', 'project', 'proposal', 'portfolio_item')),
  target_id uuid not null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 2000),
  source text not null default 'user' check (source in ('user', 'system')),
  signals text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now()
);
create unique index content_reports_one_open_user on public.content_reports (reporter_user_id, target_type, target_id)
  where status = 'open' and reporter_user_id is not null;
create unique index content_reports_one_open_system on public.content_reports (target_type, target_id, reason)
  where status = 'open' and source = 'system';
create index content_reports_queue_idx on public.content_reports (status, created_at);
create index content_reports_target_idx on public.content_reports (target_type, target_id);
create index content_reports_handled_by_idx on public.content_reports (handled_by) where handled_by is not null;

-- Automatic flags (contact details, prompt injection, repeated policy hits) for moderators.
create function app_private.flag_for_review(p_target_type text, p_target_id uuid, p_reason public.report_reason, p_signals text[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.content_reports (target_type, target_id, reason, source, signals)
  values (p_target_type, p_target_id, p_reason, 'system', coalesce(p_signals, '{}'))
  on conflict (target_type, target_id, reason) where status = 'open' and source = 'system'
  do update set signals = (select array(select distinct unnest(public.content_reports.signals || excluded.signals)));
$$;

alter table public.moderation_actions drop constraint moderation_actions_target_type_check;
alter table public.moderation_actions add constraint moderation_actions_target_type_check
  check (target_type in ('provider', 'listing', 'portfolio_item', 'term', 'category', 'message', 'project', 'proposal', 'user'));
alter table public.moderation_actions drop constraint moderation_actions_action_check;
alter table public.moderation_actions add constraint moderation_actions_action_check
  check (action in ('approve', 'reject', 'suspend', 'reinstate', 'remove', 'restore', 'warn'));
alter table public.moderation_actions add column report_id uuid references public.content_reports (id) on delete set null;
alter table public.moderation_actions add column affected_user_id uuid references public.profiles (id) on delete set null;
create index moderation_actions_report_idx on public.moderation_actions (report_id) where report_id is not null;
create index moderation_actions_affected_idx on public.moderation_actions (affected_user_id) where affected_user_id is not null;

alter policy moderation_actions_read on public.moderation_actions
  using ((provider_id is not null and (select app.owns_provider(provider_id)))
         or affected_user_id = (select auth.uid())
         or (select app.is_staff(array['super_admin', 'admin', 'moderator']::public.staff_role[])));

-- Close a report without further action, or record that it was acted on.
create function public.admin_resolve_report(p_report_id uuid, p_outcome text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(p_note), '');
begin
  perform app_private.require_staff(array['super_admin', 'admin', 'moderator']::public.staff_role[]);
  if p_outcome not in ('dismissed', 'actioned') then
    raise exception 'unknown outcome %', p_outcome using errcode = '22023';
  end if;
  update public.content_reports
     set status = p_outcome, handled_by = auth.uid(), handled_at = now(), resolution_note = v_note
   where id = p_report_id and status = 'open';
  if not found then
    raise exception 'report is not open' using errcode = '55000';
  end if;
  perform app_private.write_audit('report.' || p_outcome, 'content_report', p_report_id::text, null, null, v_note);
end;
$$;

-- Moderation decisions now notify the expert (replaces the Phase 3 versions).
create or replace function public.admin_review(p_request_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.review_requests;
  v_reason text := nullif(btrim(p_reason), '');
begin
  perform app_private.require_staff(array['super_admin', 'admin', 'moderator']::public.staff_role[]);
  if p_decision not in ('approve', 'reject') then
    raise exception 'unknown decision %', p_decision using errcode = '22023';
  end if;
  if p_decision = 'reject' and char_length(coalesce(v_reason, '')) < 10 then
    raise exception 'a rejection needs a statement of reasons (10+ characters)' using errcode = '22023';
  end if;

  select * into r from public.review_requests where id = p_request_id for update;
  if not found or r.status <> 'pending' then
    raise exception 'review request is not pending' using errcode = '55000';
  end if;

  if r.target_type = 'listing' then
    if p_decision = 'approve' and r.kind = 'initial' then
      update public.service_listings set status = 'published', published_at = coalesce(published_at, now())
       where id = r.target_id and status = 'pending_review';
    elsif p_decision = 'reject' then
      update public.service_listings set status = 'rejected'
       where id = r.target_id and status in ('pending_review', 'published', 'paused');
    end if;
  else
    if p_decision = 'approve' and r.kind = 'initial' then
      update public.providers set status = 'active', published_at = coalesce(published_at, now())
       where id = r.target_id and status = 'pending_review';
    elsif p_decision = 'reject' then
      update public.providers set status = 'draft'
       where id = r.target_id and status in ('pending_review', 'active');
    end if;
  end if;

  update public.review_requests
     set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
         decided_at = now(), decided_by = auth.uid(), reason = v_reason
   where id = r.id;

  insert into public.moderation_actions (target_type, target_id, provider_id, action, reason, actor_staff_id)
  values (r.target_type, r.target_id, r.provider_id, p_decision, v_reason, auth.uid());

  perform app_private.write_audit('moderation.' || p_decision, r.target_type, r.target_id::text, null,
    jsonb_build_object('request_id', r.id, 'kind', r.kind), v_reason);
  perform app_private.enqueue_event('moderation.decided', r.target_type, r.target_id,
    jsonb_build_object('decision', p_decision, 'kind', r.kind));
  perform app_private.notify(
    (select owner_user_id from public.providers where id = r.provider_id),
    'moderation.decided', r.target_type, r.target_id,
    jsonb_build_object('decision', p_decision, 'kind', r.kind, 'targetType', r.target_type,
      'title', case when r.target_type = 'listing' then (select title from public.service_listings where id = r.target_id) end));
end;
$$;
create or replace function public.admin_set_status(p_target_type text, p_target_id uuid, p_action text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
  v_provider uuid;
begin
  perform app_private.require_staff(array['super_admin', 'admin', 'moderator']::public.staff_role[]);
  if p_action not in ('suspend', 'reinstate') or p_target_type not in ('provider', 'listing') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  if p_action = 'suspend' and char_length(coalesce(v_reason, '')) < 10 then
    raise exception 'a suspension needs a statement of reasons (10+ characters)' using errcode = '22023';
  end if;

  if p_target_type = 'provider' then
    update public.providers
       set status = case when p_action = 'suspend' then 'suspended'::public.provider_status else 'active'::public.provider_status end
     where id = p_target_id
       and status = case when p_action = 'suspend' then status else 'suspended'::public.provider_status end
    returning id into v_provider;
  else
    update public.service_listings
       set status = case when p_action = 'suspend' then 'suspended'::public.listing_status else 'published'::public.listing_status end
     where id = p_target_id
       and status = case when p_action = 'suspend' then status else 'suspended'::public.listing_status end
    returning provider_id into v_provider;
  end if;

  if v_provider is null then
    raise exception 'nothing to %', p_action using errcode = '55000';
  end if;

  insert into public.moderation_actions (target_type, target_id, provider_id, action, reason, actor_staff_id)
  values (p_target_type, p_target_id, v_provider, p_action, v_reason, auth.uid());
  perform app_private.write_audit('moderation.' || p_action, p_target_type, p_target_id::text, null, null, v_reason);
  perform app_private.enqueue_event('moderation.' || p_action, p_target_type, p_target_id);
  perform app_private.notify(
    (select owner_user_id from public.providers where id = v_provider),
    'moderation.decided', p_target_type, p_target_id,
    jsonb_build_object('decision', p_action, 'targetType', p_target_type,
      'title', case when p_target_type = 'listing' then (select title from public.service_listings where id = p_target_id) end));
end;
$$;

-- Grants and RLS ----------------------------------------------------------------------------------
alter table public.notification_types enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.saved_searches enable row level security;
alter table public.content_reports enable row level security;

grant select on public.notification_types to authenticated;
create policy notification_types_read on public.notification_types for select to authenticated using (true);

grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

grant select, delete on public.notification_preferences to authenticated;
grant insert (user_id, type_key, channel, enabled), update (enabled, updated_at) on public.notification_preferences to authenticated;
create policy notification_preferences_own on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_preferences_insert_own on public.notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.notification_types t where t.key = type_key and t.user_configurable));
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_preferences_delete_own on public.notification_preferences for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, delete on public.saved_searches to authenticated;
grant insert (user_id, kind, name, query, alerts_enabled), update (name, alerts_enabled) on public.saved_searches to authenticated;
create policy saved_searches_own on public.saved_searches for select to authenticated using (user_id = (select auth.uid()));
create policy saved_searches_insert_own on public.saved_searches for insert to authenticated with check (user_id = (select auth.uid()));
create policy saved_searches_update_own on public.saved_searches for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_searches_delete_own on public.saved_searches for delete to authenticated using (user_id = (select auth.uid()));

grant select on public.content_reports to authenticated;
create policy content_reports_read on public.content_reports for select to authenticated
  using (reporter_user_id = (select auth.uid())
         or (select app.is_staff(array['super_admin', 'admin', 'moderator', 'support']::public.staff_role[])));

revoke all on function public.my_counts() from public, anon, authenticated;
grant execute on function public.my_counts() to authenticated;
revoke all on function public.admin_resolve_report(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;

revoke all on all functions in schema app_private from public, anon, authenticated;
