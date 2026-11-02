-- Phase 4: private attachments, conversations, messages with the contact policy (A-13), blocks,
-- user reports and realtime channels. See ARCHITECTURE.md §11 and §13, DATABASE_SCHEMA.md §15-16.

-- Private attachments -------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760, array[
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain', 'text/csv', 'text/markdown',
  'application/json', 'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
])
on conflict (id) do nothing;

alter table public.file_objects add column display_name text check (char_length(display_name) <= 200);

-- Uploads go to "<user id>/<purpose>/<uuid>"; files are scanned before anyone else can download them.
create function public.register_private_file(
  p_path text,
  p_purpose public.file_purpose,
  p_mime text,
  p_size bigint,
  p_sha256 text,
  p_display_name text
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
  if p_purpose not in ('message_attachment', 'project_attachment') then
    raise exception 'unsupported purpose' using errcode = '22023';
  end if;
  if split_part(p_path, '/', 1) <> auth.uid()::text or split_part(p_path, '/', 2) <> p_purpose::text then
    raise exception 'path does not belong to this user' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'attachments' and o.name = p_path) then
    raise exception 'file not uploaded' using errcode = '22023';
  end if;
  insert into public.file_objects (bucket, path, owner_user_id, purpose, mime_type, size_bytes, sha256, scan_status, display_name)
  values ('attachments', p_path, auth.uid(), p_purpose, p_mime, p_size, p_sha256, 'pending', left(btrim(p_display_name), 200))
  returning id into v_id;
  perform app_private.enqueue_event('file.uploaded', 'file', v_id, jsonb_build_object('bucket', 'attachments', 'path', p_path));
  return v_id;
end;
$$;

create table public.project_attachments (
  project_id uuid not null references public.projects (id) on delete cascade,
  file_id uuid not null references public.file_objects (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (project_id, file_id)
);
create index project_attachments_file_idx on public.project_attachments (file_id);
create trigger project_attachments_limit after insert on public.project_attachments
  for each row execute function app_private.enforce_child_limit('project_id', '10');

-- Conversations ---------------------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct', 'order', 'support')),
  client_user_id uuid references public.profiles (id) on delete set null,
  provider_id uuid references public.providers (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  context_listing_id uuid references public.service_listings (id) on delete set null,
  context_project_id uuid references public.projects (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'archived', 'locked')),
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index conversations_direct_pair on public.conversations (client_user_id, provider_id) where kind = 'direct';
create index conversations_provider_idx on public.conversations (provider_id);
create index conversations_created_by_idx on public.conversations (created_by) where created_by is not null;
create index conversations_listing_idx on public.conversations (context_listing_id) where context_listing_id is not null;
create index conversations_project_idx on public.conversations (context_project_id) where context_project_id is not null;

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  participant_kind text not null check (participant_kind in ('client', 'provider', 'staff')),
  provider_id uuid references public.providers (id) on delete set null,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted boolean not null default false,
  archived_at timestamptz,
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);
create index conversation_participants_provider_idx on public.conversation_participants (provider_id) where provider_id is not null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_user_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'system', 'attachment')),
  body text check (char_length(body) <= 5000),
  context_listing_id uuid references public.service_listings (id) on delete set null,
  context_project_id uuid references public.projects (id) on delete set null,
  moderation_state text not null default 'visible' check (moderation_state in ('visible', 'masked', 'held', 'removed')),
  contact_flags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_user_id, created_at desc);
create index messages_listing_idx on public.messages (context_listing_id) where context_listing_id is not null;
create index messages_project_idx on public.messages (context_project_id) where context_project_id is not null;

create table public.message_attachments (
  message_id uuid not null references public.messages (id) on delete cascade,
  file_id uuid not null references public.file_objects (id) on delete restrict,
  primary key (message_id, file_id)
);
create index message_attachments_file_idx on public.message_attachments (file_id);

-- Bodies of messages removed by moderators, kept for the case record.
create table app_private.removed_message_bodies (
  message_id uuid primary key references public.messages (id) on delete cascade,
  body text,
  removed_at timestamptz not null default now()
);

create table public.user_blocks (
  blocker_user_id uuid not null references public.profiles (id) on delete cascade,
  blocked_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_user_id);

create table app_private.contact_policy_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  signals text[] not null,
  action text not null check (action in ('warned', 'masked', 'held', 'flagged')),
  created_at timestamptz not null default now()
);
create index contact_policy_events_user_idx on app_private.contact_policy_events (user_id, created_at desc);

insert into public.platform_settings (key, value, description, is_public) values
  ('messaging.contact_policy', '{"before_order": "mask", "after_order": "warn", "flag_after_attempts": 3}',
   'Contact details in messages (A-13): mask or warn before the first order between two people, warn after. Repeat attempts in 7 days are flagged for moderators.', false)
on conflict (key) do nothing;

-- Helpers -----------------------------------------------------------------------------------------------
create function app.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_participants cp
     where cp.conversation_id = p_conversation_id and cp.user_id = auth.uid()
  );
$$;

create function app.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b
     where (b.blocker_user_id = p_a and b.blocked_user_id = p_b) or (b.blocker_user_id = p_b and b.blocked_user_id = p_a)
  );
$$;

-- Files attached to a message or project the current user can see (metadata only; downloads also
-- need a clean scan).
create function app.file_is_shared_with_me(p_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.message_attachments ma join public.messages m on m.id = ma.message_id
     where ma.file_id = p_file_id and app.is_conversation_participant(m.conversation_id) and m.moderation_state <> 'removed'
  ) or exists (
    select 1 from public.project_attachments pa
     where pa.file_id = p_file_id and app.project_is_visible(pa.project_id)
  );
$$;

create function app.can_download_attachment(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.file_objects f
     where f.bucket = 'attachments' and f.path = p_path and f.deleted_at is null
       and (f.owner_user_id = auth.uid() or (f.scan_status = 'clean' and app.file_is_shared_with_me(f.id)))
  );
$$;

create or replace function app.can_access_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_topic ~ '^user:[0-9a-f-]{36}$' then substring(p_topic from 6)::uuid = auth.uid()
    when p_topic ~ '^conversation:[0-9a-f-]{36}$' then app.is_conversation_participant(substring(p_topic from 14)::uuid)
    else false
  end;
$$;

revoke all on function app.is_conversation_participant(uuid), app.is_blocked_between(uuid, uuid),
  app.file_is_shared_with_me(uuid), app.can_download_attachment(text) from public;
grant execute on function app.is_conversation_participant(uuid), app.is_blocked_between(uuid, uuid),
  app.file_is_shared_with_me(uuid), app.can_download_attachment(text) to authenticated, service_role;

-- Storage: own folder for uploads; downloads for the uploader and, once clean, participants.
create policy attachments_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy attachments_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (select app.can_download_attachment(name)));

drop policy file_objects_read on public.file_objects;
create policy file_objects_read on public.file_objects for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (bucket = 'public-media' and deleted_at is null)
    or (deleted_at is null and (select app.file_is_shared_with_me(id)))
    or (select app.is_staff())
  );

-- Contact policy ------------------------------------------------------------------------------------------
-- Signals in a message: contact details, off-platform payment, and secrets pasted into chat.
create function app_private.message_signals(p_text text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct s order by s), '{}')
    from unnest(array[
      case when p_text ~* '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}' then 'contact_email' end,
      case when p_text ~* '\+?\d[\d\s().-]{7,}\d' then 'contact_phone' end,
      case when p_text ~* '(whatsapp|telegram|t\.me/|wa\.me/|signal\.me|skype|discord\.gg|wechat)' then 'contact_messenger' end,
      case when p_text ~* '(paypal|venmo|zelle|western union|bank transfer|wire transfer|iban|crypto|bitcoin|btc|usdt)' then 'payment_offsite' end,
      case when p_text ~ '(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
             or p_text ~* '(password|passwd|api[ _-]?key|secret)\s*[:=]\s*\S+' then 'secret' end
    ]) as s
   where s is not null;
$$;

-- Replace contact details with a token the app renders as "contact details hidden".
create function app_private.mask_contact_details(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(p_text, '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}', '[[contact-hidden]]', 'g'),
             '\+?\d[\d\s().-]{7,}\d', '[[contact-hidden]]', 'g'),
           '(t\.me|wa\.me|signal\.me|discord\.gg)/\S+', '[[contact-hidden]]', 'gi');
$$;

-- Orders arrive in Phase 6; until then no pair has one, so the "before the first order" rule applies.
create function app_private.pair_has_order(p_client uuid, p_provider uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select false;
$$;

-- Conversation functions ------------------------------------------------------------------------------------
/*
 * Open (or reuse) the direct conversation between a client and an expert. Clients may contact any
 * live expert. Experts may contact a client only about a project they were invited to or proposed on.
 */
create function public.conversations_open(
  p_provider_id uuid default null,
  p_client_user_id uuid default null,
  p_context_project_id uuid default null,
  p_context_listing_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
  v_provider uuid;
  v_provider_owner uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_provider_id is not null then
    -- A client contacting an expert.
    if not app.has_role('client') then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    select id, owner_user_id into v_provider, v_provider_owner
      from public.providers where id = p_provider_id and status = 'active';
    if v_provider is null then
      raise exception 'expert not available' using errcode = '22023';
    end if;
    v_client := auth.uid();
  elsif p_client_user_id is not null then
    -- An expert replying to a client about a project.
    if not app.has_role('expert') then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    select id, owner_user_id into v_provider, v_provider_owner from public.providers where owner_user_id = auth.uid();
    if v_provider is null or not exists (
      select 1 from public.projects p
       where p.client_user_id = p_client_user_id
         and (p_context_project_id is null or p.id = p_context_project_id)
         and (exists (select 1 from public.proposals pp where pp.project_id = p.id and pp.provider_id = v_provider and pp.status <> 'draft')
              or exists (select 1 from public.project_invitations pi where pi.project_id = p.id and pi.provider_id = v_provider))
    ) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    v_client := p_client_user_id;
  else
    raise exception 'missing counterpart' using errcode = '22023';
  end if;

  if v_client = v_provider_owner then
    raise exception 'you cannot message yourself' using errcode = '42501';
  end if;
  if app.is_blocked_between(v_client, v_provider_owner) then
    raise exception 'blocked' using errcode = '42501';
  end if;

  select id into v_id from public.conversations where kind = 'direct' and client_user_id = v_client and provider_id = v_provider;
  if v_id is null then
    insert into public.conversations (kind, client_user_id, provider_id, created_by, context_listing_id, context_project_id)
    values ('direct', v_client, v_provider, auth.uid(), p_context_listing_id, p_context_project_id)
    on conflict (client_user_id, provider_id) where kind = 'direct' do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.conversations where kind = 'direct' and client_user_id = v_client and provider_id = v_provider;
    end if;
    insert into public.conversation_participants (conversation_id, user_id, participant_kind, provider_id) values
      (v_id, v_client, 'client', null),
      (v_id, v_provider_owner, 'provider', v_provider)
    on conflict do nothing;
  elsif p_context_listing_id is not null or p_context_project_id is not null then
    update public.conversations
       set context_listing_id = coalesce(p_context_listing_id, context_listing_id),
           context_project_id = coalesce(p_context_project_id, context_project_id)
     where id = v_id;
  end if;
  return v_id;
end;
$$;

/*
 * Send a message. Checks participation, blocks, rate limits and attachments, applies the contact
 * policy, notifies the other side and broadcasts to the conversation channel.
 * Returns {id, masked, signals}.
 */
create function public.messages_send(
  p_conversation_id uuid,
  p_body text,
  p_file_ids uuid[] default '{}',
  p_context_project_id uuid default null,
  p_context_listing_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conversations;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_files uuid[] := coalesce(p_file_ids, '{}');
  v_other uuid;
  v_signals text[] := '{}';
  v_policy jsonb;
  v_action text;
  v_masked boolean := false;
  v_state text := 'visible';
  v_id uuid;
  v_attempts integer;
  v_sender_name text;
begin
  if not app.is_conversation_participant(p_conversation_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.conversations where id = p_conversation_id;
  if c.status <> 'active' then
    raise exception 'conversation is closed' using errcode = '55000';
  end if;
  if v_body is null and cardinality(v_files) = 0 then
    raise exception 'empty message' using errcode = '22023';
  end if;
  if char_length(coalesce(v_body, '')) > 5000 then
    raise exception 'message too long' using errcode = '22001';
  end if;
  if cardinality(v_files) > 5 then
    raise exception 'too many attachments' using errcode = '54000';
  end if;
  if (select count(*) from public.messages m where m.sender_user_id = auth.uid() and m.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'slow down' using errcode = '54000';
  end if;

  select cp.user_id into v_other from public.conversation_participants cp
   where cp.conversation_id = p_conversation_id and cp.user_id <> auth.uid() limit 1;
  if v_other is not null and app.is_blocked_between(auth.uid(), v_other) then
    raise exception 'blocked' using errcode = '42501';
  end if;

  if cardinality(v_files) > 0 and exists (
    select 1 from unnest(v_files) f(id)
     where not exists (
       select 1 from public.file_objects fo
        where fo.id = f.id and fo.owner_user_id = auth.uid() and fo.bucket = 'attachments'
          and fo.purpose = 'message_attachment' and fo.deleted_at is null
          and not exists (select 1 from public.message_attachments ma where ma.file_id = fo.id))
  ) then
    raise exception 'invalid attachment' using errcode = '42501';
  end if;

  -- Contact policy (A-13).
  if v_body is not null then
    v_signals := app_private.message_signals(v_body);
    select s.value into v_policy from public.platform_settings s where s.key = 'messaging.contact_policy';
    v_policy := coalesce(v_policy, '{"before_order": "mask", "after_order": "warn", "flag_after_attempts": 3}'::jsonb);
    v_action := case when app_private.pair_has_order(c.client_user_id, c.provider_id)
                     then v_policy ->> 'after_order' else v_policy ->> 'before_order' end;
    if v_action = 'mask' and v_signals && array['contact_email', 'contact_phone', 'contact_messenger'] then
      v_body := app_private.mask_contact_details(v_body);
      v_masked := v_body like '%[[contact-hidden]]%';
      if v_masked then v_state := 'masked'; end if;
    end if;
  end if;

  insert into public.messages (conversation_id, sender_user_id, kind, body, context_project_id, context_listing_id, moderation_state, contact_flags)
  values (p_conversation_id, auth.uid(), case when v_body is null then 'attachment' else 'text' end, v_body,
          p_context_project_id, p_context_listing_id, v_state, v_signals)
  returning id into v_id;

  if cardinality(v_files) > 0 then
    insert into public.message_attachments (message_id, file_id) select v_id, unnest(v_files);
  end if;

  if v_signals && array['contact_email', 'contact_phone', 'contact_messenger', 'payment_offsite'] then
    insert into app_private.contact_policy_events (message_id, user_id, signals, action)
    values (v_id, auth.uid(), v_signals, case when v_masked then 'masked' else 'warned' end);
    select count(*) into v_attempts from app_private.contact_policy_events e
     where e.user_id = auth.uid() and e.created_at > now() - interval '7 days';
    if v_attempts >= coalesce((v_policy ->> 'flag_after_attempts')::integer, 3) then
      perform app_private.flag_for_review('user', auth.uid(), 'off_platform', v_signals);
      insert into app_private.contact_policy_events (message_id, user_id, signals, action) values (v_id, auth.uid(), v_signals, 'flagged');
    end if;
  end if;

  update public.conversations
     set last_message_at = now(),
         context_project_id = coalesce(p_context_project_id, context_project_id),
         context_listing_id = coalesce(p_context_listing_id, context_listing_id)
   where id = p_conversation_id;
  update public.conversation_participants set last_read_at = now(), archived_at = null
   where conversation_id = p_conversation_id and user_id = auth.uid();
  update public.conversation_participants set archived_at = null
   where conversation_id = p_conversation_id and user_id <> auth.uid();

  select coalesce(p.display_name, p.full_name) into v_sender_name from public.profiles p where p.id = auth.uid();
  if v_other is not null and not exists (
    select 1 from public.conversation_participants cp where cp.conversation_id = p_conversation_id and cp.user_id = v_other and cp.muted
  ) then
    perform app_private.notify(v_other, 'message.received', 'conversation', p_conversation_id,
      jsonb_build_object('senderName', v_sender_name), 'conversation:' || p_conversation_id::text);
  end if;
  perform app_private.broadcast('conversation:' || p_conversation_id::text, 'message', jsonb_build_object('id', v_id));

  return jsonb_build_object('id', v_id, 'masked', v_masked, 'signals', to_jsonb(v_signals));
end;
$$;

create function public.conversations_mark_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_conversation_participant(p_conversation_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.conversation_participants set last_read_at = now()
   where conversation_id = p_conversation_id and user_id = auth.uid();
  update public.notifications set read_at = now()
   where user_id = auth.uid() and group_key = 'conversation:' || p_conversation_id::text and read_at is null;
end;
$$;

-- Counters for the header badge.
create or replace function public.my_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'notifications', (select count(*) from public.notifications n
                       where n.user_id = auth.uid() and n.read_at is null and n.type_key <> 'message.received'),
    'messages', (select count(*) from public.conversation_participants cp
                  where cp.user_id = auth.uid()
                    and exists (select 1 from public.messages m
                                 where m.conversation_id = cp.conversation_id
                                   and m.sender_user_id is distinct from auth.uid()
                                   and m.moderation_state <> 'removed'
                                   and m.created_at > coalesce(cp.last_read_at, '-infinity'::timestamptz)))
  );
$$;

-- Reports -------------------------------------------------------------------------------------------------
create function public.reports_create(p_target_type text, p_target_id uuid, p_reason public.report_reason, p_details text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if (select count(*) from public.content_reports r where r.reporter_user_id = auth.uid() and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many reports today' using errcode = '54000';
  end if;
  v_ok := case p_target_type
    when 'message' then exists (select 1 from public.messages m where m.id = p_target_id and app.is_conversation_participant(m.conversation_id)
                                 and m.sender_user_id is distinct from auth.uid())
    when 'user' then exists (select 1 from public.profiles p where p.id = p_target_id and p.id <> auth.uid())
    when 'provider' then exists (select 1 from public.providers p where p.id = p_target_id and p.owner_user_id <> auth.uid())
    when 'listing' then app.listing_is_visible(p_target_id) and not app.owns_listing(p_target_id)
    when 'project' then app.project_is_visible(p_target_id) and not app.owns_project(p_target_id)
    when 'proposal' then app.proposal_is_visible(p_target_id) and not app.owns_proposal(p_target_id)
    when 'portfolio_item' then app.portfolio_item_is_visible(p_target_id) and not app.owns_portfolio_item(p_target_id)
    else false
  end;
  if not coalesce(v_ok, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.content_reports (reporter_user_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(btrim(p_details), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Staff read a reported message with a little context. Every view is audited (SECURITY.md §9).
create function public.admin_reported_message(p_report_id uuid)
returns table (message_id uuid, sender_user_id uuid, sender_name text, body text, moderation_state text, created_at timestamptz, is_reported boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.content_reports;
  v_conversation uuid;
  v_at timestamptz;
begin
  perform app_private.require_staff(array['super_admin', 'admin', 'moderator', 'support']::public.staff_role[]);
  select * into r from public.content_reports where id = p_report_id;
  if r.id is null or r.target_type <> 'message' then
    raise exception 'not a message report' using errcode = '22023';
  end if;
  select m.conversation_id, m.created_at into v_conversation, v_at from public.messages m where m.id = r.target_id;
  perform app_private.write_audit('conversation.viewed_by_staff', 'conversation', v_conversation::text,
    null, jsonb_build_object('report_id', p_report_id));
  return query
    select m.id, m.sender_user_id, coalesce(p.display_name, p.full_name),
           coalesce(m.body, rb.body), m.moderation_state, m.created_at, m.id = r.target_id
      from public.messages m
      left join public.profiles p on p.id = m.sender_user_id
      left join app_private.removed_message_bodies rb on rb.message_id = m.id
     where m.conversation_id = v_conversation
       and m.created_at between v_at - interval '2 days' and v_at + interval '2 days'
     order by m.created_at
     limit 30;
end;
$$;

create function public.admin_moderate_message(p_message_id uuid, p_action text, p_reason text default null, p_report_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.messages;
  v_reason text := nullif(btrim(p_reason), '');
begin
  perform app_private.require_staff(array['super_admin', 'admin', 'moderator']::public.staff_role[]);
  if p_action not in ('remove', 'restore') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  if p_action = 'remove' and char_length(coalesce(v_reason, '')) < 10 then
    raise exception 'a removal needs a statement of reasons (10+ characters)' using errcode = '22023';
  end if;
  select * into m from public.messages where id = p_message_id for update;
  if m.id is null then
    raise exception 'message not found' using errcode = '22023';
  end if;
  if p_action = 'remove' then
    if m.moderation_state = 'removed' then
      raise exception 'already removed' using errcode = '55000';
    end if;
    insert into app_private.removed_message_bodies (message_id, body) values (m.id, m.body)
    on conflict (message_id) do update set body = excluded.body, removed_at = now();
    update public.messages set body = null, moderation_state = 'removed' where id = m.id;
    perform app_private.notify(m.sender_user_id, 'content.removed', 'conversation', m.conversation_id,
      jsonb_build_object('reason', v_reason, 'targetType', 'message'));
  else
    if m.moderation_state <> 'removed' then
      raise exception 'not removed' using errcode = '55000';
    end if;
    update public.messages
       set body = (select rb.body from app_private.removed_message_bodies rb where rb.message_id = m.id),
           moderation_state = case when cardinality(m.contact_flags) > 0 then 'masked' else 'visible' end
     where id = m.id;
    delete from app_private.removed_message_bodies where message_id = m.id;
  end if;
  insert into public.moderation_actions (target_type, target_id, affected_user_id, action, reason, actor_staff_id, report_id)
  values ('message', m.id, m.sender_user_id, p_action, v_reason, auth.uid(), p_report_id);
  perform app_private.write_audit('moderation.message_' || p_action, 'message', m.id::text, null, null, v_reason);
end;
$$;

-- Grants and RLS ---------------------------------------------------------------------------------------------
alter table public.project_attachments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.user_blocks enable row level security;

grant select, insert, delete on public.project_attachments to authenticated;
create policy project_attachments_read on public.project_attachments for select to authenticated
  using ((select app.project_is_visible(project_id)));
create policy project_attachments_insert_own on public.project_attachments for insert to authenticated
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.client_user_id = (select auth.uid()) and p.status in ('draft', 'open'))
    and exists (select 1 from public.file_objects f where f.id = file_id and f.owner_user_id = (select auth.uid())
                 and f.purpose = 'project_attachment' and f.bucket = 'attachments' and f.deleted_at is null)
  );
create policy project_attachments_delete_own on public.project_attachments for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.client_user_id = (select auth.uid())
                  and p.status in ('draft', 'open')));

-- Conversations and messages: participants only, written through the functions above (Class B).
grant select on public.conversations, public.messages, public.message_attachments to authenticated;
grant select on public.conversation_participants to authenticated;
grant update (muted, archived_at) on public.conversation_participants to authenticated;
create policy conversations_read on public.conversations for select to authenticated
  using ((select app.is_conversation_participant(id)));
create policy conversation_participants_read on public.conversation_participants for select to authenticated
  using ((select app.is_conversation_participant(conversation_id)));
create policy conversation_participants_update_own on public.conversation_participants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy messages_read on public.messages for select to authenticated
  using ((select app.is_conversation_participant(conversation_id)));
create policy message_attachments_read on public.message_attachments for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and (select app.is_conversation_participant(m.conversation_id))));

grant select, delete on public.user_blocks to authenticated;
grant insert (blocker_user_id, blocked_user_id) on public.user_blocks to authenticated;
create policy user_blocks_own on public.user_blocks for select to authenticated using (blocker_user_id = (select auth.uid()));
create policy user_blocks_insert_own on public.user_blocks for insert to authenticated with check (blocker_user_id = (select auth.uid()));
create policy user_blocks_delete_own on public.user_blocks for delete to authenticated using (blocker_user_id = (select auth.uid()));

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.register_private_file(text, public.file_purpose, text, bigint, text, text)',
    'public.conversations_open(uuid, uuid, uuid, uuid)',
    'public.messages_send(uuid, text, uuid[], uuid, uuid)',
    'public.conversations_mark_read(uuid)',
    'public.reports_create(text, uuid, public.report_reason, text)',
    'public.admin_reported_message(uuid)',
    'public.admin_moderate_message(uuid, text, text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

revoke all on all functions in schema app_private from public, anon, authenticated;
