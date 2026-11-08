-- Phase 4 support: the conversation list with each counterpart's public name, discarding private
-- attachments, and service-role functions for the email, scanning, digest and saved-search jobs.

-- Conversations ----------------------------------------------------------------------------------
/*
 * The signed-in user's conversations. Profiles are private, so the counterpart's name comes from
 * here: an expert's public display name, or a client's display name (first name if none is set).
 */
create function public.my_conversations(p_archived boolean default false, p_conversation_id uuid default null)
returns table (
  id uuid,
  kind text,
  status text,
  last_message_at timestamptz,
  created_at timestamptz,
  my_role text,
  counterpart_user_id uuid,
  counterpart_provider_id uuid,
  counterpart_name text,
  counterpart_handle text,
  counterpart_avatar_path text,
  context_project_id uuid,
  context_project_title text,
  context_listing_id uuid,
  context_listing_title text,
  unread_count bigint,
  last_body text,
  last_moderation_state text,
  last_sender_is_me boolean,
  muted boolean,
  archived boolean,
  blocked_by_me boolean,
  can_reply boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.kind, c.status, c.last_message_at, c.created_at,
         me.participant_kind,
         other.user_id,
         case when me.participant_kind = 'client' then c.provider_id end,
         case when me.participant_kind = 'client' then pr.display_name
              else coalesce(op.display_name, split_part(op.full_name, ' ', 1)) end,
         case when me.participant_kind = 'client' and pr.status = 'active' then pr.handle end,
         case when me.participant_kind = 'client' then pa.path else oa.path end,
         case when app.project_is_visible(c.context_project_id) then c.context_project_id end,
         case when app.project_is_visible(c.context_project_id) then pj.title end,
         c.context_listing_id,
         sl.title,
         (select count(*) from public.messages m
           where m.conversation_id = c.id and m.sender_user_id is distinct from auth.uid() and m.moderation_state <> 'removed'
             and m.created_at > coalesce(me.last_read_at, '-infinity'::timestamptz)),
         last.body, last.moderation_state, last.sender_user_id = auth.uid(),
         me.muted,
         me.archived_at is not null,
         exists (select 1 from public.user_blocks b where b.blocker_user_id = auth.uid() and b.blocked_user_id = other.user_id),
         c.status = 'active' and other.user_id is not null and not app.is_blocked_between(auth.uid(), other.user_id)
    from public.conversation_participants me
    join public.conversations c on c.id = me.conversation_id
    left join lateral (
      select cp.user_id from public.conversation_participants cp
       where cp.conversation_id = c.id and cp.user_id <> auth.uid() and cp.participant_kind <> 'staff'
       limit 1
    ) other on true
    left join public.profiles op on op.id = other.user_id
    left join public.file_objects oa on oa.id = op.avatar_file_id and oa.bucket = 'public-media' and oa.deleted_at is null
    left join public.providers pr on pr.id = c.provider_id
    left join public.file_objects pa on pa.id = pr.avatar_file_id and pa.deleted_at is null
    left join public.projects pj on pj.id = c.context_project_id
    left join public.service_listings sl on sl.id = c.context_listing_id
    left join lateral (
      select m.body, m.moderation_state, m.sender_user_id from public.messages m
       where m.conversation_id = c.id order by m.created_at desc limit 1
    ) last on true
   where me.user_id = auth.uid()
     and (p_conversation_id is null or c.id = p_conversation_id)
     and (p_archived is null or (me.archived_at is not null) = p_archived)
   order by coalesce(c.last_message_at, c.created_at) desc
   limit 100;
$$;

-- Discarding files ---------------------------------------------------------------------------------
-- Owners discard public images and private attachments once nothing references them. The app then
-- deletes the stored object through the Storage API (storage policy: own folder only).
create or replace function public.discard_uploaded_file(p_file_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  select path into v_path
    from public.file_objects
   where id = p_file_id and owner_user_id = auth.uid() and bucket in ('public-media', 'attachments') and deleted_at is null
   for update;
  if v_path is null then
    raise exception 'file not found' using errcode = '42501';
  end if;
  if exists (select 1 from public.providers where avatar_file_id = p_file_id or cover_file_id = p_file_id)
     or exists (select 1 from public.profiles where avatar_file_id = p_file_id)
     or exists (select 1 from public.service_media where file_id = p_file_id)
     or exists (select 1 from public.portfolio_item_media where file_id = p_file_id)
     or exists (select 1 from public.project_attachments where file_id = p_file_id)
     or exists (select 1 from public.message_attachments where file_id = p_file_id) then
    raise exception 'file is still in use' using errcode = '55000';
  end if;
  update public.file_objects set deleted_at = now() where id = p_file_id;
  return v_path;
end;
$$;

-- Jobs (service role only) ---------------------------------------------------------------------------
-- What an email for a notification needs, or null when no email should be sent.
create function public.notification_email_payload(p_notification_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
begin
  select n.id, n.user_id, n.type_key, n.entity_type, n.entity_id, n.params, n.count,
         u.email::text as email, p.locale, coalesce(p.display_name, split_part(p.full_name, ' ', 1)) as name,
         p.account_status, p.deleted_at
    into r
    from public.notifications n
    join public.profiles p on p.id = n.user_id
    join auth.users u on u.id = n.user_id
   where n.id = p_notification_id;
  if r.id is null or r.account_status <> 'active' or r.deleted_at is not null or r.email is null then
    return null;
  end if;
  if not app_private.notification_enabled(r.user_id, r.type_key, 'email') then
    return null;
  end if;
  if exists (select 1 from app_private.notification_deliveries d where d.notification_id = r.id and d.channel = 'email') then
    return null;
  end if;
  return jsonb_build_object('id', r.id, 'userId', r.user_id, 'email', r.email, 'locale', r.locale, 'name', r.name,
    'type', r.type_key, 'entityType', r.entity_type, 'entityId', r.entity_id, 'params', r.params, 'count', r.count);
end;
$$;

create function public.notification_record_delivery(p_notification_id uuid, p_status text, p_provider_ref text default null, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into app_private.notification_deliveries (notification_id, channel, status, provider_ref, error)
  values (p_notification_id, 'email', p_status, left(p_provider_ref, 200), left(p_error, 500))
  on conflict (notification_id, channel)
  do update set status = excluded.status, provider_ref = excluded.provider_ref, error = excluded.error, created_at = now();
$$;

-- One unread-messages digest per user every 12 hours at most.
create table app_private.email_digests (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_sent_at timestamptz not null
);

create function public.unread_digest_candidates(p_min_age_minutes integer default 60, p_limit integer default 100)
returns table (user_id uuid, email text, locale text, name text, unread_conversations bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, u.email::text, p.locale, coalesce(p.display_name, split_part(p.full_name, ' ', 1)), count(distinct cp.conversation_id)
    from public.conversation_participants cp
    join public.profiles p on p.id = cp.user_id and p.account_status = 'active' and p.deleted_at is null
    join auth.users u on u.id = p.id
    left join app_private.email_digests d on d.user_id = p.id
   where not cp.muted
     and u.email is not null
     and (d.last_sent_at is null or d.last_sent_at < now() - interval '12 hours')
     and exists (
       select 1 from public.messages m
        where m.conversation_id = cp.conversation_id
          and m.sender_user_id is distinct from cp.user_id
          and m.moderation_state <> 'removed'
          and m.created_at > coalesce(cp.last_read_at, '-infinity'::timestamptz)
          and m.created_at > coalesce(d.last_sent_at, '-infinity'::timestamptz)
          and m.created_at <= now() - make_interval(mins => p_min_age_minutes))
     and app_private.notification_enabled(p.id, 'messages.unread_digest', 'email')
   group by p.id, u.email, p.locale, p.display_name, p.full_name
   limit p_limit;
$$;

create function public.unread_digest_mark_sent(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into app_private.email_digests (user_id, last_sent_at) values (p_user_id, now())
  on conflict (user_id) do update set last_sent_at = now();
$$;

-- File scanning: the job reads the target, scans it, and records the verdict once.
create function public.file_scan_target(p_file_id uuid)
returns table (bucket text, path text, mime_type text, size_bytes bigint, scan_status public.scan_status)
language sql
stable
security definer
set search_path = ''
as $$
  select f.bucket, f.path, f.mime_type, f.size_bytes, f.scan_status from public.file_objects f
   where f.id = p_file_id and f.deleted_at is null;
$$;

create function public.file_record_scan(p_file_id uuid, p_status public.scan_status, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status = 'pending' then
    raise exception 'a scan verdict is required' using errcode = '22023';
  end if;
  update public.file_objects set scan_status = p_status where id = p_file_id and scan_status = 'pending';
  if found and p_status = 'infected' then
    perform app_private.write_audit('file.scan_infected', 'file', p_file_id::text, null, null, left(p_detail, 500));
  end if;
end;
$$;

-- Saved-search alerts: due searches, then one in-app notification per search with new matches.
create function public.saved_search_alert_candidates(p_limit integer default 100)
returns table (id uuid, user_id uuid, kind text, name text, query jsonb, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, s.kind, s.name, s.query, coalesce(s.last_alerted_at, s.created_at)
    from public.saved_searches s
    join public.profiles p on p.id = s.user_id and p.account_status = 'active' and p.deleted_at is null
   where s.alerts_enabled and (s.last_alerted_at is null or s.last_alerted_at < now() - interval '20 hours')
   order by s.last_alerted_at nulls first
   limit p_limit;
$$;

create function public.saved_search_record_alert(p_id uuid, p_matches integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_name text;
begin
  update public.saved_searches set last_alerted_at = now() where id = p_id returning user_id, name into v_user, v_name;
  if v_user is not null and p_matches > 0 then
    perform app_private.notify(v_user, 'saved_search.match', 'saved_search', p_id,
      jsonb_build_object('name', v_name, 'count', p_matches), null, null);
  end if;
end;
$$;

-- Privileges ------------------------------------------------------------------------------------------
revoke all on function public.my_conversations(boolean, uuid) from public, anon, authenticated;
grant execute on function public.my_conversations(boolean, uuid) to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.notification_email_payload(uuid)',
    'public.notification_record_delivery(uuid, text, text, text)',
    'public.unread_digest_candidates(integer, integer)',
    'public.unread_digest_mark_sent(uuid)',
    'public.file_scan_target(uuid)',
    'public.file_record_scan(uuid, public.scan_status, text)',
    'public.saved_search_alert_candidates(integer)',
    'public.saved_search_record_alert(uuid, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

revoke all on all functions in schema app_private from public, anon, authenticated;
