-- Phase 4: client projects, invitations and expert proposals (DATABASE_SCHEMA.md §9).
-- Accepting a proposal creates an offer and an order in Phase 6; until then clients compare,
-- shortlist, decline and message experts.

create type public.project_status as enum ('draft', 'open', 'closed', 'hired', 'cancelled', 'expired', 'removed');
create type public.project_visibility as enum ('public', 'invite_only');
create type public.budget_kind as enum ('fixed', 'range', 'hourly', 'not_sure');
create type public.timeline_kind as enum ('asap', 'weeks', 'months', 'flexible');
create type public.proposal_status as enum ('draft', 'submitted', 'shortlisted', 'declined', 'withdrawn', 'accepted', 'expired');
create type public.proposal_pricing as enum ('fixed', 'hourly_block');
create type public.invitation_status as enum ('sent', 'declined', 'proposal_submitted');

-- Projects -----------------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references public.profiles (id) on delete restrict,
  title text not null check (char_length(title) between 5 and 120),
  description text check (char_length(description) <= 8000),
  business_problem text check (char_length(business_problem) <= 2000),
  desired_outcome text check (char_length(desired_outcome) <= 2000),
  category_id uuid references public.categories (id) on delete set null,
  budget_kind public.budget_kind not null default 'not_sure',
  currency char(3) not null default 'USD' check (currency in ('USD', 'EUR')),
  budget_min_minor bigint check (budget_min_minor > 0),
  budget_max_minor bigint check (budget_max_minor > 0),
  timeline_kind public.timeline_kind not null default 'flexible',
  deadline date,
  visibility public.project_visibility not null default 'public',
  status public.project_status not null default 'draft',
  source text not null default 'manual' check (source in ('manual', 'discovery')),
  proposals_count integer not null default 0,
  published_at timestamptz,
  expires_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min_minor is null or budget_max_minor is null or budget_max_minor >= budget_min_minor)
);
create index projects_client_idx on public.projects (client_user_id, created_at desc);
create index projects_board_idx on public.projects (status, visibility, published_at desc);
create index projects_category_idx on public.projects (category_id) where category_id is not null;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function extensions.moddatetime(updated_at);

create table public.project_terms (
  project_id uuid not null references public.projects (id) on delete cascade,
  term_id uuid not null references public.taxonomy_terms (id) on delete cascade,
  primary key (project_id, term_id)
);
create index project_terms_term_idx on public.project_terms (term_id);
create trigger project_terms_limit after insert on public.project_terms
  for each row execute function app_private.enforce_child_limit('project_id', '10');

create table public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  message text check (char_length(message) <= 1000),
  status public.invitation_status not null default 'sent',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (project_id, provider_id)
);
create index project_invitations_provider_idx on public.project_invitations (provider_id, created_at desc);
create index project_invitations_invited_by_idx on public.project_invitations (invited_by) where invited_by is not null;
create trigger project_invitations_limit after insert on public.project_invitations
  for each row execute function app_private.enforce_child_limit('project_id', '30');

-- Proposals ------------------------------------------------------------------------------------
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete restrict,
  submitted_by_user_id uuid not null references public.profiles (id) on delete restrict,
  status public.proposal_status not null default 'draft',
  proposed_solution text check (char_length(proposed_solution) <= 8000),
  relevant_experience text check (char_length(relevant_experience) <= 3000),
  questions text check (char_length(questions) <= 2000),
  conditions text check (char_length(conditions) <= 2000),
  currency char(3) not null default 'USD' check (currency in ('USD', 'EUR')),
  pricing_model public.proposal_pricing not null default 'fixed',
  price_minor bigint check (price_minor > 0),
  hours smallint check (hours between 1 and 2000),
  estimated_days smallint check (estimated_days between 1 and 730),
  revisions_included smallint check (revisions_included between 0 and 20),
  payment_model public.payment_model not null default 'full',
  deposit_bps integer check (deposit_bps between 1000 and 9000),
  balance_trigger public.balance_trigger,
  valid_until timestamptz,
  submitted_at timestamptz,
  decided_at timestamptz,
  decline_reason text check (char_length(decline_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payment_model = 'full' or (deposit_bps is not null and balance_trigger is not null)),
  check (pricing_model = 'fixed' or hours is not null)
);
create unique index proposals_one_active on public.proposals (project_id, provider_id)
  where status not in ('withdrawn', 'declined', 'expired');
create index proposals_project_idx on public.proposals (project_id, status);
create index proposals_provider_idx on public.proposals (provider_id, created_at desc);
create index proposals_submitted_by_idx on public.proposals (submitted_by_user_id);
create trigger proposals_set_updated_at before update on public.proposals
  for each row execute function extensions.moddatetime(updated_at);

create table public.proposal_deliverables (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  sort_order smallint not null default 0
);
create index proposal_deliverables_proposal_idx on public.proposal_deliverables (proposal_id, sort_order);
create trigger proposal_deliverables_limit after insert on public.proposal_deliverables
  for each row execute function app_private.enforce_child_limit('proposal_id', '20');

create table public.proposal_milestones (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  seq smallint not null check (seq between 1 and 10),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 1000),
  amount_minor bigint not null check (amount_minor > 0),
  due_offset_days smallint not null check (due_offset_days between 1 and 730),
  unique (proposal_id, seq)
);
create trigger proposal_milestones_limit after insert on public.proposal_milestones
  for each row execute function app_private.enforce_child_limit('proposal_id', '10');

-- Helpers -----------------------------------------------------------------------------------------
create function app.owns_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.projects p where p.id = p_project_id and p.client_user_id = auth.uid());
$$;

/*
 * Projects are visible to their owner, to staff, to experts while public and open, to invited
 * experts, and to experts who already proposed. Never to anonymous visitors (E-29).
 */
create function app.project_is_visible(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
     where p.id = p_project_id
       and (
         p.client_user_id = auth.uid()
         or (p.status = 'open' and p.visibility = 'public' and app.has_role('expert'))
         or (p.status <> 'draft' and exists (
               select 1 from public.project_invitations i join public.providers pr on pr.id = i.provider_id
                where i.project_id = p.id and pr.owner_user_id = auth.uid()))
         or exists (
               select 1 from public.proposals pp join public.providers pr on pr.id = pp.provider_id
                where pp.project_id = p.id and pr.owner_user_id = auth.uid())
       )
  ) or app.is_staff();
$$;

/* Open for proposals: status open and not past its expiry date. */
create function app.project_accepts_proposals(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
     where p.id = p_project_id and p.status = 'open' and (p.expires_at is null or p.expires_at > now())
  );
$$;

create function app.owns_proposal(p_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.proposals pp join public.providers pr on pr.id = pp.provider_id
     where pp.id = p_proposal_id and pr.owner_user_id = auth.uid()
  );
$$;

/* The provider owner sees every own proposal; the client sees it once submitted; staff too. */
create function app.proposal_is_visible(p_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.owns_proposal(p_proposal_id)
      or exists (
           select 1 from public.proposals pp join public.projects p on p.id = pp.project_id
            where pp.id = p_proposal_id and pp.status <> 'draft' and p.client_user_id = auth.uid())
      or app.is_staff();
$$;

create function app.proposal_is_editable(p_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.owns_proposal(p_proposal_id)
     and exists (select 1 from public.proposals pp where pp.id = p_proposal_id and pp.status = 'draft');
$$;

revoke all on function app.owns_project(uuid), app.project_is_visible(uuid), app.project_accepts_proposals(uuid),
  app.owns_proposal(uuid), app.proposal_is_visible(uuid), app.proposal_is_editable(uuid) from public;
grant execute on function app.owns_project(uuid), app.project_is_visible(uuid), app.project_accepts_proposals(uuid),
  app.owns_proposal(uuid), app.proposal_is_visible(uuid), app.proposal_is_editable(uuid) to authenticated, service_role;

-- Keep proposals_count in step with live proposals.
create function app_private.refresh_proposals_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid := coalesce(new.project_id, old.project_id);
begin
  update public.projects
     set proposals_count = (select count(*) from public.proposals pp
                             where pp.project_id = v_project and pp.status in ('submitted', 'shortlisted', 'accepted'))
   where id = v_project;
  return null;
end;
$$;
create trigger proposals_count after insert or update of status or delete on public.proposals
  for each row execute function app_private.refresh_proposals_count();

-- Project functions -----------------------------------------------------------------------------
create function public.project_checklist(p_project_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.projects;
  v_missing text[] := '{}';
begin
  if not (app.owns_project(p_project_id) or app.is_staff()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into p from public.projects where id = p_project_id;
  if char_length(coalesce(p.description, '')) < 100 then v_missing := array_append(v_missing, 'description'); end if;
  if p.category_id is null or not exists (select 1 from public.categories c where c.id = p.category_id and c.is_active) then
    v_missing := array_append(v_missing, 'category');
  end if;
  if p.budget_kind in ('fixed', 'hourly') and p.budget_max_minor is null and p.budget_min_minor is null then
    v_missing := array_append(v_missing, 'budget');
  elsif p.budget_kind = 'range' and (p.budget_min_minor is null or p.budget_max_minor is null) then
    v_missing := array_append(v_missing, 'budget');
  end if;
  if p.deadline is not null and p.deadline < current_date then v_missing := array_append(v_missing, 'deadline'); end if;
  return v_missing;
end;
$$;

-- draft -> open. Returns missing checklist items; empty means published.
create function public.projects_publish(p_project_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.projects;
  v_missing text[];
  v_flags text[];
begin
  if not app.owns_project(p_project_id) or not app.has_role('client') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into p from public.projects where id = p_project_id for update;
  if p.status <> 'draft' then
    raise exception 'project cannot be published from status %', p.status using errcode = '55000';
  end if;
  v_missing := public.project_checklist(p_project_id);
  if cardinality(v_missing) > 0 then
    return v_missing;
  end if;

  update public.projects
     set status = 'open', published_at = now(), expires_at = now() + interval '30 days', closed_at = null
   where id = p_project_id;

  -- Projects go live at once; contact details or injection attempts are queued for moderators.
  v_flags := app_private.detect_review_flags(concat_ws(' ', p.title, p.description, p.business_problem, p.desired_outcome));
  if cardinality(v_flags) > 0 then
    perform app_private.flag_for_review('project', p_project_id, 'off_platform', v_flags);
  end if;
  perform app_private.write_audit('project.published', 'project', p_project_id::text);
  perform app_private.enqueue_event('project.published', 'project', p_project_id);
  return '{}';
end;
$$;

-- close (open -> closed, live proposals expire) | reopen (closed/expired -> open for 30 days)
create function public.projects_change_status(p_project_id uuid, p_action text)
returns public.project_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.projects;
  v_next public.project_status;
  r record;
begin
  if not app.owns_project(p_project_id) or not app.has_role('client') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into p from public.projects where id = p_project_id for update;
  v_next := case
    when p_action = 'close' and p.status = 'open' then 'closed'
    when p_action = 'reopen' and p.status in ('closed', 'expired') then 'open'
    else null
  end::public.project_status;
  if v_next is null then
    raise exception 'cannot % a project that is %', p_action, p.status using errcode = '55000';
  end if;

  if v_next = 'closed' then
    update public.projects set status = 'closed', closed_at = now() where id = p_project_id;
    for r in
      update public.proposals set status = 'expired', decided_at = now()
       where project_id = p_project_id and status in ('submitted', 'shortlisted')
      returning id, provider_id
    loop
      perform app_private.notify((select owner_user_id from public.providers where id = r.provider_id),
        'proposal.expired', 'proposal', r.id, jsonb_build_object('projectTitle', p.title));
    end loop;
  else
    update public.projects set status = 'open', closed_at = null, expires_at = now() + interval '30 days' where id = p_project_id;
  end if;
  perform app_private.write_audit('project.' || p_action, 'project', p_project_id::text,
    jsonb_build_object('status', p.status), jsonb_build_object('status', v_next));
  return v_next;
end;
$$;

-- Invite an approved expert to a project (public or invite-only).
create function public.projects_invite(p_project_id uuid, p_provider_id uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.projects;
  v_owner uuid;
  v_id uuid;
begin
  if not app.owns_project(p_project_id) or not app.has_role('client') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into p from public.projects where id = p_project_id;
  if p.status <> 'open' then
    raise exception 'only open projects can invite experts' using errcode = '55000';
  end if;
  select owner_user_id into v_owner from public.providers where id = p_provider_id and status = 'active';
  if v_owner is null then
    raise exception 'expert not available' using errcode = '22023';
  end if;
  if v_owner = auth.uid() then
    raise exception 'you cannot invite yourself' using errcode = '42501';
  end if;

  insert into public.project_invitations (project_id, provider_id, invited_by, message)
  values (p_project_id, p_provider_id, auth.uid(), nullif(btrim(p_message), ''))
  on conflict (project_id, provider_id) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'expert already invited' using errcode = '23505';
  end if;
  perform app_private.notify(v_owner, 'project.invited', 'project', p_project_id,
    jsonb_build_object('projectTitle', p.title));
  return v_id;
end;
$$;

create function public.invitations_decline(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i record;
begin
  select pi.id, pi.project_id, pi.status, pr.owner_user_id, pr.display_name, p.client_user_id, p.title
    into i
    from public.project_invitations pi
    join public.providers pr on pr.id = pi.provider_id
    join public.projects p on p.id = pi.project_id
   where pi.id = p_invitation_id
   for update of pi;
  if i.id is null or i.owner_user_id <> auth.uid() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if i.status <> 'sent' then
    raise exception 'invitation already answered' using errcode = '55000';
  end if;
  update public.project_invitations set status = 'declined', responded_at = now() where id = p_invitation_id;
  perform app_private.notify(i.client_user_id, 'invitation.declined', 'project', i.project_id,
    jsonb_build_object('projectTitle', i.title, 'expertName', i.display_name));
end;
$$;

-- Proposal functions ------------------------------------------------------------------------------
create function public.proposal_checklist(p_proposal_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pp public.proposals;
  p public.projects;
  v_missing text[] := '{}';
  v_min bigint;
  v_allowed jsonb;
  v_milestones integer;
  v_milestone_sum bigint;
  v_max_seq integer;
begin
  if not (app.owns_proposal(p_proposal_id) or app.is_staff()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into pp from public.proposals where id = p_proposal_id;
  select * into p from public.projects where id = pp.project_id;

  if not exists (select 1 from public.providers pr where pr.id = pp.provider_id and pr.status = 'active') then
    v_missing := array_append(v_missing, 'profile_approved');
  end if;
  if not app.project_accepts_proposals(pp.project_id) then v_missing := array_append(v_missing, 'project_open'); end if;
  if char_length(coalesce(pp.proposed_solution, '')) < 100 then v_missing := array_append(v_missing, 'solution'); end if;
  if pp.currency <> p.currency then v_missing := array_append(v_missing, 'currency'); end if;
  v_min := app_private.setting_minor('payments.min_order_minor', pp.currency, 2500);
  if pp.price_minor is null then
    v_missing := array_append(v_missing, 'price');
  elsif pp.price_minor < v_min then
    v_missing := array_append(v_missing, 'min_order');
  end if;
  if pp.estimated_days is null then v_missing := array_append(v_missing, 'timeline'); end if;

  if pp.payment_model = 'deposit' then
    select s.value into v_allowed from public.platform_settings s where s.key = 'payments.deposit_allowed_bps';
    if pp.deposit_bps is null or not (coalesce(v_allowed, '[2000,3000,4000,5000]'::jsonb) @> to_jsonb(pp.deposit_bps)) then
      v_missing := array_append(v_missing, 'deposit');
    elsif coalesce(pp.price_minor, 0) < app_private.setting_minor('payments.deposit_min_order_minor', pp.currency, 30000) then
      v_missing := array_append(v_missing, 'deposit_min_order');
    end if;
  end if;

  select count(*), coalesce(sum(amount_minor), 0), coalesce(max(seq), 0)
    into v_milestones, v_milestone_sum, v_max_seq
    from public.proposal_milestones where proposal_id = p_proposal_id;
  if v_milestones > 0 and (v_milestone_sum <> coalesce(pp.price_minor, -1) or v_max_seq <> v_milestones) then
    v_missing := array_append(v_missing, 'milestones');
  end if;
  if pp.payment_model = 'deposit' and pp.balance_trigger = 'on_milestone_acceptance' and v_milestones < 2 then
    v_missing := array_append(v_missing, 'milestones_for_trigger');
  end if;
  return v_missing;
end;
$$;

-- draft -> submitted. Returns missing checklist items; empty means submitted.
create function public.proposals_submit(p_proposal_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  pp public.proposals;
  p public.projects;
  v_missing text[];
  v_name text;
begin
  if not app.owns_proposal(p_proposal_id) or not app.has_role('expert') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into pp from public.proposals where id = p_proposal_id for update;
  if pp.status <> 'draft' then
    raise exception 'proposal cannot be submitted from status %', pp.status using errcode = '55000';
  end if;
  select * into p from public.projects where id = pp.project_id;
  if p.client_user_id = auth.uid() then
    raise exception 'you cannot propose on your own project' using errcode = '42501';
  end if;
  v_missing := public.proposal_checklist(p_proposal_id);
  if cardinality(v_missing) > 0 then
    return v_missing;
  end if;

  update public.proposals
     set status = 'submitted', submitted_at = now(), valid_until = coalesce(valid_until, now() + interval '14 days')
   where id = p_proposal_id;
  update public.project_invitations set status = 'proposal_submitted', responded_at = coalesce(responded_at, now())
   where project_id = pp.project_id and provider_id = pp.provider_id and status = 'sent';

  select display_name into v_name from public.providers where id = pp.provider_id;
  perform app_private.notify(p.client_user_id, 'proposal.received', 'project', p.id,
    jsonb_build_object('projectTitle', p.title, 'expertName', v_name), 'proposals:' || p.id::text);
  perform app_private.write_audit('proposal.submitted', 'proposal', p_proposal_id::text);
  return '{}';
end;
$$;

-- Client decisions: shortlist | decline (with an optional, polite reason).
create function public.proposals_decide(p_proposal_id uuid, p_action text, p_reason text default null)
returns public.proposal_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  pp public.proposals;
  p public.projects;
  v_next public.proposal_status;
begin
  select * into pp from public.proposals where id = p_proposal_id for update;
  select * into p from public.projects where id = pp.project_id;
  if pp.id is null or p.client_user_id is distinct from auth.uid() or not app.has_role('client') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_next := case
    when p_action = 'shortlist' and pp.status = 'submitted' then 'shortlisted'
    when p_action = 'unshortlist' and pp.status = 'shortlisted' then 'submitted'
    when p_action = 'decline' and pp.status in ('submitted', 'shortlisted') then 'declined'
    else null
  end::public.proposal_status;
  if v_next is null then
    raise exception 'cannot % a proposal that is %', p_action, pp.status using errcode = '55000';
  end if;

  update public.proposals
     set status = v_next,
         decided_at = case when v_next = 'declined' then now() else decided_at end,
         decline_reason = case when v_next = 'declined' then nullif(btrim(p_reason), '') else decline_reason end
   where id = p_proposal_id;

  if v_next in ('shortlisted', 'declined') then
    perform app_private.notify((select owner_user_id from public.providers where id = pp.provider_id),
      case when v_next = 'shortlisted' then 'proposal.shortlisted' else 'proposal.declined' end,
      'proposal', p_proposal_id, jsonb_build_object('projectTitle', p.title));
  end if;
  return v_next;
end;
$$;

create function public.proposals_withdraw(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pp public.proposals;
  p public.projects;
begin
  if not app.owns_proposal(p_proposal_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into pp from public.proposals where id = p_proposal_id for update;
  if pp.status not in ('submitted', 'shortlisted') then
    raise exception 'proposal cannot be withdrawn from status %', pp.status using errcode = '55000';
  end if;
  select * into p from public.projects where id = pp.project_id;
  update public.proposals set status = 'withdrawn', decided_at = now() where id = p_proposal_id;
  perform app_private.notify(p.client_user_id, 'proposal.withdrawn', 'project', p.id,
    jsonb_build_object('projectTitle', p.title, 'expertName', (select display_name from public.providers where id = pp.provider_id)));
end;
$$;

-- Staff: remove a project that breaks the rules (or restore it), with a statement of reasons.
create function public.admin_set_project_status(p_project_id uuid, p_action text, p_reason text default null, p_report_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.projects;
  v_reason text := nullif(btrim(p_reason), '');
begin
  perform app_private.require_staff(array['super_admin', 'admin', 'moderator']::public.staff_role[]);
  if p_action not in ('remove', 'restore') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  if p_action = 'remove' and char_length(coalesce(v_reason, '')) < 10 then
    raise exception 'a removal needs a statement of reasons (10+ characters)' using errcode = '22023';
  end if;
  select * into p from public.projects where id = p_project_id for update;
  if p.id is null then
    raise exception 'project not found' using errcode = '22023';
  end if;
  if p_action = 'remove' then
    update public.projects set status = 'removed', closed_at = now() where id = p_project_id and status <> 'removed';
  else
    update public.projects set status = 'closed' where id = p_project_id and status = 'removed';
  end if;
  if not found then
    raise exception 'nothing to %', p_action using errcode = '55000';
  end if;
  insert into public.moderation_actions (target_type, target_id, affected_user_id, action, reason, actor_staff_id, report_id)
  values ('project', p_project_id, p.client_user_id, p_action, v_reason, auth.uid(), p_report_id);
  if p_action = 'remove' then
    perform app_private.notify(p.client_user_id, 'content.removed', 'project', p_project_id,
      jsonb_build_object('title', p.title, 'reason', v_reason));
  end if;
  perform app_private.write_audit('moderation.project_' || p_action, 'project', p_project_id::text, null, null, v_reason);
end;
$$;

-- Grants and RLS -------------------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_terms enable row level security;
alter table public.project_invitations enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_deliverables enable row level security;
alter table public.proposal_milestones enable row level security;

grant select, delete on public.projects to authenticated;
grant insert (id, client_user_id, title, description, business_problem, desired_outcome, category_id, budget_kind,
  currency, budget_min_minor, budget_max_minor, timeline_kind, deadline, visibility) on public.projects to authenticated;
grant update (title, description, business_problem, desired_outcome, category_id, budget_kind, currency,
  budget_min_minor, budget_max_minor, timeline_kind, deadline, visibility) on public.projects to authenticated;
create policy projects_read on public.projects for select to authenticated using ((select app.project_is_visible(id)));
create policy projects_insert_own on public.projects for insert to authenticated
  with check (client_user_id = (select auth.uid()) and (select app.has_role('client')));
create policy projects_update_own on public.projects for update to authenticated
  using (client_user_id = (select auth.uid()) and status in ('draft', 'open'))
  with check (client_user_id = (select auth.uid()));
create policy projects_delete_draft on public.projects for delete to authenticated
  using (client_user_id = (select auth.uid()) and status = 'draft');

grant select, insert, delete on public.project_terms to authenticated;
create policy project_terms_read on public.project_terms for select to authenticated
  using ((select app.project_is_visible(project_id)));
create policy project_terms_insert_own on public.project_terms for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = project_id and p.client_user_id = (select auth.uid())
                       and p.status in ('draft', 'open'))
              and exists (select 1 from public.taxonomy_terms t where t.id = term_id and t.status = 'active'));
create policy project_terms_delete_own on public.project_terms for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.client_user_id = (select auth.uid())
                  and p.status in ('draft', 'open')));

grant select on public.project_invitations to authenticated;
create policy project_invitations_read on public.project_invitations for select to authenticated
  using ((select app.owns_project(project_id)) or (select app.owns_provider(provider_id)) or (select app.is_staff()));

grant select, delete on public.proposals to authenticated;
grant insert (id, project_id, provider_id, submitted_by_user_id, proposed_solution, relevant_experience, questions, conditions,
  currency, pricing_model, price_minor, hours, estimated_days, revisions_included, payment_model, deposit_bps, balance_trigger)
  on public.proposals to authenticated;
grant update (proposed_solution, relevant_experience, questions, conditions, currency, pricing_model, price_minor, hours,
  estimated_days, revisions_included, payment_model, deposit_bps, balance_trigger) on public.proposals to authenticated;
create policy proposals_read on public.proposals for select to authenticated using ((select app.proposal_is_visible(id)));
create policy proposals_insert_own on public.proposals for insert to authenticated
  with check (
    submitted_by_user_id = (select auth.uid())
    and (select app.owns_provider(provider_id))
    and (select app.has_role('expert'))
    and (select app.project_is_visible(project_id))
    and (select app.project_accepts_proposals(project_id))
    and not (select app.owns_project(project_id))
  );
create policy proposals_update_draft on public.proposals for update to authenticated
  using ((select app.proposal_is_editable(id))) with check ((select app.owns_provider(provider_id)));
create policy proposals_delete_draft on public.proposals for delete to authenticated
  using ((select app.proposal_is_editable(id)));

do $$
declare
  t text;
begin
  foreach t in array array['proposal_deliverables', 'proposal_milestones'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select app.proposal_is_visible(proposal_id)))', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select app.proposal_is_editable(proposal_id)))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select app.proposal_is_editable(proposal_id))) with check ((select app.proposal_is_editable(proposal_id)))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select app.proposal_is_editable(proposal_id)))', t || '_delete_own', t);
  end loop;
end;
$$;

-- Function privileges ----------------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.project_checklist(uuid)', 'public.projects_publish(uuid)', 'public.projects_change_status(uuid, text)',
    'public.projects_invite(uuid, uuid, text)', 'public.invitations_decline(uuid)', 'public.proposal_checklist(uuid)',
    'public.proposals_submit(uuid)', 'public.proposals_decide(uuid, text, text)', 'public.proposals_withdraw(uuid)',
    'public.admin_set_project_status(uuid, text, text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

revoke all on all functions in schema app_private from public, anon, authenticated;
