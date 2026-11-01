-- Security layer: least-privilege grants, RLS policies, authorization helpers,
-- signup trigger, role and legal functions, audit triggers and outbox RPCs.
-- Table write classes (CLAUDE.md): A = owner writes under RLS (column grants below);
-- B = multi-party tables via SECURITY DEFINER functions; C = privileged server code only.

-- New objects in public get no automatic grants for anon/authenticated: grant explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Authorization helpers -----------------------------------------------------
create function app.has_role(p_role public.marketplace_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.user_roles r
      join public.profiles p on p.id = r.user_id
     where r.user_id = auth.uid()
       and r.role = p_role
       and r.status = 'active'
       and p.account_status = 'active'
  );
$$;

-- Staff powers require MFA (aal2) on the current session (SECURITY.md §3).
create function app.is_staff(p_roles public.staff_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1
         from public.staff_roles s
        where s.user_id = auth.uid()
          and s.revoked_at is null
          and (p_roles is null or s.role = any (p_roles))
     );
$$;

create function app.owns_provider(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.providers pr where pr.id = p_provider_id and pr.owner_user_id = auth.uid()
  );
$$;

create function app.provider_is_visible(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.providers pr
     where pr.id = p_provider_id
       and (pr.status = 'active' or pr.owner_user_id = auth.uid())
  ) or app.is_staff();
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;

-- Enable RLS everywhere and start from zero privileges ------------------------
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on table public.%I from anon, authenticated', t.tablename);
  end loop;
end;
$$;

-- Reference data: readable by everyone ----------------------------------------
grant select on public.countries to anon, authenticated;
create policy countries_read on public.countries for select to anon, authenticated using (true);

grant select on public.categories, public.category_translations, public.category_relations,
  public.taxonomy_terms, public.taxonomy_term_translations, public.taxonomy_term_aliases,
  public.category_terms to anon, authenticated;

create policy categories_read_anon on public.categories for select to anon using (is_active);
create policy categories_read on public.categories for select to authenticated
  using (is_active or (select app.is_staff()));
create policy category_translations_read on public.category_translations for select to anon, authenticated using (true);
create policy category_relations_read on public.category_relations for select to anon, authenticated using (true);
create policy taxonomy_terms_read_anon on public.taxonomy_terms for select to anon using (status = 'active');
create policy taxonomy_terms_read on public.taxonomy_terms for select to authenticated
  using (status = 'active' or suggested_by = (select auth.uid()) or (select app.is_staff()));
create policy taxonomy_term_translations_read on public.taxonomy_term_translations for select to anon, authenticated using (true);
create policy taxonomy_term_aliases_read on public.taxonomy_term_aliases for select to anon, authenticated using (true);
create policy category_terms_read on public.category_terms for select to anon, authenticated using (true);

-- Legal --------------------------------------------------------------------------
grant select on public.legal_documents to anon, authenticated;
create policy legal_documents_read on public.legal_documents for select to anon, authenticated
  using (published_at is not null and published_at <= now());

grant select on public.legal_acceptances to authenticated;
create policy legal_acceptances_read on public.legal_acceptances for select to authenticated
  using (user_id = (select auth.uid()) or (select app.is_staff(array['super_admin', 'admin', 'support']::public.staff_role[])));

-- Profiles (Class A for the listed columns only) ---------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, display_name, country_code, locale, timezone) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select app.is_staff(array['super_admin', 'admin', 'support', 'moderator']::public.staff_role[])));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()) and account_status = 'active')
  with check (id = (select auth.uid()));

create function app_private.profiles_validate_country()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.country_code is not null
     and new.country_code is distinct from old.country_code
     and not exists (select 1 from public.countries c where c.code = new.country_code and c.can_register) then
    raise exception 'registration is not available for country %', new.country_code
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger profiles_validate_country before update of country_code on public.profiles
  for each row execute function app_private.profiles_validate_country();

grant select on public.user_roles to authenticated;
create policy user_roles_read on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select app.is_staff()));

grant select on public.staff_roles to authenticated;
create policy staff_roles_read on public.staff_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select app.is_staff(array['super_admin', 'admin']::public.staff_role[])));

grant select on public.file_objects to authenticated;
create policy file_objects_read on public.file_objects for select to authenticated
  using (owner_user_id = (select auth.uid()) or (select app.is_staff()));

grant select on public.client_profiles to authenticated;
grant update (account_type, business_name, industry_term_id, company_size, website_url, purpose, challenges)
  on public.client_profiles to authenticated;
create policy client_profiles_read on public.client_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select app.is_staff()));
create policy client_profiles_update_own on public.client_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Providers --------------------------------------------------------------------
grant select (id, provider_type, handle, display_name, headline, bio, avatar_file_id, cover_file_id,
  country_code, city, timezone, experience_level, years_experience, indicative_hourly_rate_minor,
  rate_currency, availability, availability_note, website_url, status, source_locale, published_at)
  on public.providers to anon;
grant select on public.providers to authenticated;
grant update (provider_type, display_name, headline, bio, country_code, city, timezone, experience_level,
  years_experience, indicative_hourly_rate_minor, rate_currency, availability, availability_note,
  website_url, source_locale)
  on public.providers to authenticated;

create policy providers_read_anon on public.providers for select to anon using (status = 'active');
create policy providers_read on public.providers for select to authenticated
  using (status = 'active' or owner_user_id = (select auth.uid()) or (select app.is_staff()));
create policy providers_update_own on public.providers for update to authenticated
  using (owner_user_id = (select auth.uid()) and status not in ('suspended', 'deactivated'))
  with check (owner_user_id = (select auth.uid()));

grant select (provider_id, founded_year, team_size_range, office_locations, updated_at)
  on public.provider_agency_details to anon;
grant select on public.provider_agency_details to authenticated;
grant insert (provider_id, founded_year, team_size_range, office_locations, legal_name, registration_number),
  update (founded_year, team_size_range, office_locations, legal_name, registration_number)
  on public.provider_agency_details to authenticated;
create policy provider_agency_details_read on public.provider_agency_details for select to anon, authenticated
  using ((select app.provider_is_visible(provider_id)));
create policy provider_agency_details_insert_own on public.provider_agency_details for insert to authenticated
  with check ((select app.owns_provider(provider_id)));
create policy provider_agency_details_update_own on public.provider_agency_details for update to authenticated
  using ((select app.owns_provider(provider_id)))
  with check ((select app.owns_provider(provider_id)));

grant select on public.provider_languages to anon, authenticated;
grant insert, update, delete on public.provider_languages to authenticated;
create policy provider_languages_read on public.provider_languages for select to anon, authenticated
  using ((select app.provider_is_visible(provider_id)));
create policy provider_languages_insert_own on public.provider_languages for insert to authenticated
  with check ((select app.owns_provider(provider_id)));
create policy provider_languages_update_own on public.provider_languages for update to authenticated
  using ((select app.owns_provider(provider_id)))
  with check ((select app.owns_provider(provider_id)));
create policy provider_languages_delete_own on public.provider_languages for delete to authenticated
  using ((select app.owns_provider(provider_id)));

grant select on public.provider_links to anon, authenticated;
grant insert (provider_id, kind, url), update (kind, url), delete on public.provider_links to authenticated;
create policy provider_links_read on public.provider_links for select to anon, authenticated
  using ((select app.provider_is_visible(provider_id)));
create policy provider_links_insert_own on public.provider_links for insert to authenticated
  with check ((select app.owns_provider(provider_id)));
create policy provider_links_update_own on public.provider_links for update to authenticated
  using ((select app.owns_provider(provider_id)))
  with check ((select app.owns_provider(provider_id)));
create policy provider_links_delete_own on public.provider_links for delete to authenticated
  using ((select app.owns_provider(provider_id)));

-- A changed URL loses any earlier verification.
create function app_private.provider_links_reset_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.url is distinct from old.url then
    new.verified_at := null;
  end if;
  return new;
end;
$$;
create trigger provider_links_reset_verification before update on public.provider_links
  for each row execute function app_private.provider_links_reset_verification();

grant select on public.provider_terms to anon, authenticated;
grant insert (provider_id, term_id, years, is_featured), update (years, is_featured), delete
  on public.provider_terms to authenticated;
create policy provider_terms_read on public.provider_terms for select to anon, authenticated
  using ((select app.provider_is_visible(provider_id)));
create policy provider_terms_insert_own on public.provider_terms for insert to authenticated
  with check (
    (select app.owns_provider(provider_id))
    and exists (select 1 from public.taxonomy_terms t where t.id = term_id and t.status = 'active')
  );
create policy provider_terms_update_own on public.provider_terms for update to authenticated
  using ((select app.owns_provider(provider_id)))
  with check ((select app.owns_provider(provider_id)));
create policy provider_terms_delete_own on public.provider_terms for delete to authenticated
  using ((select app.owns_provider(provider_id)));

-- Platform configuration (writes only through privileged admin code) -------------
grant select on public.platform_settings, public.feature_flags to anon, authenticated;
create policy platform_settings_read_anon on public.platform_settings for select to anon using (is_public);
create policy platform_settings_read on public.platform_settings for select to authenticated
  using (is_public or (select app.is_staff()));
create policy feature_flags_read_anon on public.feature_flags for select to anon using (is_public);
create policy feature_flags_read on public.feature_flags for select to authenticated
  using (is_public or (select app.is_staff()));

-- Account creation ------------------------------------------------------------------
create function app_private.provider_handle_for(p_user uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'expert-' || left(replace(p_user::text, '-', ''), 12);
$$;

create function app_private.ensure_role_profile(
  p_user uuid,
  p_role public.marketplace_role,
  p_name text,
  p_country char(2)
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_role = 'client' then
    insert into public.client_profiles (user_id) values (p_user)
    on conflict (user_id) do nothing;
  else
    insert into public.providers (owner_user_id, display_name, handle, country_code)
    values (p_user, p_name, app_private.provider_handle_for(p_user), p_country)
    on conflict (owner_user_id) do nothing;
  end if;
end;
$$;

-- Runs when Supabase Auth creates a user. raw_user_meta_data is user-controlled, so every
-- value is validated; staff roles can never be created here.
create function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.marketplace_role :=
    case when v_meta ->> 'initial_role' = 'expert' then 'expert'::public.marketplace_role
         else 'client'::public.marketplace_role end;
  v_country char(2) := upper(left(nullif(btrim(v_meta ->> 'country_code'), ''), 2));
  v_name text;
begin
  if v_country is not null
     and not exists (select 1 from public.countries c where c.code = v_country and c.can_register) then
    v_country := null;
  end if;

  v_name := left(btrim(coalesce(
    nullif(btrim(v_meta ->> 'full_name'), ''),
    nullif(btrim(v_meta ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  )), 120);
  if char_length(v_name) < 2 then
    v_name := 'Greco user';
  end if;

  insert into public.profiles (id, full_name, country_code, active_role)
  values (new.id, v_name, v_country, v_role);

  insert into public.user_roles (user_id, role) values (new.id, v_role);
  perform app_private.ensure_role_profile(new.id, v_role, v_name, v_country);

  if v_meta ->> 'legal_accepted' = 'true' then
    insert into public.legal_acceptances (user_id, document_id, context)
    select new.id, d.id, 'registration' from public.current_legal_documents() d
    on conflict (user_id, document_id) do nothing;
  end if;

  perform app_private.enqueue_event('identity.user_registered', 'profile', new.id,
    jsonb_build_object('initial_role', v_role));
  return new;
end;
$$;

-- Role switching (ARCHITECTURE.md §8) -----------------------------------------------
create function public.switch_active_role(p_role public.marketplace_role)
returns public.marketplace_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1
      from public.user_roles r
      join public.profiles p on p.id = r.user_id
     where r.user_id = v_user and r.role = p_role and r.status = 'active' and p.account_status = 'active'
  ) then
    raise exception 'role % is not enabled for this account', p_role using errcode = '42501';
  end if;

  update public.profiles set active_role = p_role where id = v_user;
  return p_role;
end;
$$;

create function public.enable_marketplace_role(p_role public.marketplace_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_status public.role_status;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into v_profile from public.profiles where id = v_user;
  if v_profile.account_status is distinct from 'active' then
    raise exception 'account is not active' using errcode = '42501';
  end if;

  select r.status into v_status from public.user_roles r where r.user_id = v_user and r.role = p_role;
  if v_status = 'suspended' then
    raise exception 'role % is suspended for this account', p_role using errcode = '42501';
  end if;

  if v_status is null then
    insert into public.user_roles (user_id, role) values (v_user, p_role);
    perform app_private.ensure_role_profile(v_user, p_role, v_profile.full_name, v_profile.country_code);
    perform app_private.write_audit('identity.role_enabled', 'profile', v_user::text, null,
      jsonb_build_object('role', p_role));
    perform app_private.enqueue_event('identity.role_enabled', 'profile', v_user,
      jsonb_build_object('role', p_role));
  end if;
end;
$$;

-- Legal acceptance ---------------------------------------------------------------------
create function public.current_legal_documents()
returns setof public.legal_documents
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (d.kind) d.*
    from public.legal_documents d
   where d.requires_acceptance
     and d.locale = 'en'
     and d.published_at is not null
     and d.published_at <= now()
   order by d.kind, d.published_at desc;
$$;

create function public.has_accepted_current_legal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and not exists (
       select 1
         from public.current_legal_documents() d
        where not exists (
          select 1 from public.legal_acceptances a where a.document_id = d.id and a.user_id = auth.uid()
        )
     );
$$;

create function public.accept_current_legal_documents()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.legal_acceptances (user_id, document_id, context)
  select v_user, d.id, 'reacceptance' from public.current_legal_documents() d
  on conflict (user_id, document_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Audit triggers ------------------------------------------------------------------------
create function app_private.audit_staff_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app_private.write_audit('staff.role_granted', 'profile', new.user_id::text, null, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    perform app_private.write_audit(
      case when new.revoked_at is not null and old.revoked_at is null then 'staff.role_revoked' else 'staff.role_updated' end,
      'profile', new.user_id::text, to_jsonb(old), to_jsonb(new));
  else
    perform app_private.write_audit('staff.role_deleted', 'profile', old.user_id::text, to_jsonb(old), null);
  end if;
  return null;
end;
$$;
create trigger staff_roles_audit after insert or update or delete on public.staff_roles
  for each row execute function app_private.audit_staff_roles();

create function app_private.audit_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One branch per table: NEW only has the columns of the table that fired the trigger.
  if tg_table_name = 'profiles' then
    if new.account_status is distinct from old.account_status then
      perform app_private.write_audit('identity.account_status_changed', 'profile', new.id::text,
        jsonb_build_object('account_status', old.account_status), jsonb_build_object('account_status', new.account_status));
    end if;
  elsif tg_table_name = 'user_roles' then
    if new.status is distinct from old.status then
      perform app_private.write_audit('identity.role_status_changed', 'profile', new.user_id::text,
        jsonb_build_object('role', old.role, 'status', old.status), jsonb_build_object('role', new.role, 'status', new.status));
    end if;
  elsif tg_table_name = 'providers' then
    if new.status is distinct from old.status then
      perform app_private.write_audit('provider.status_changed', 'provider', new.id::text,
        jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
      perform app_private.enqueue_event('provider.status_changed', 'provider', new.id,
        jsonb_build_object('from', old.status, 'to', new.status));
    end if;
  end if;
  return null;
end;
$$;
create trigger profiles_audit_status after update of account_status on public.profiles
  for each row execute function app_private.audit_status_change();
create trigger user_roles_audit_status after update of status on public.user_roles
  for each row execute function app_private.audit_status_change();
create trigger providers_audit_status after update of status on public.providers
  for each row execute function app_private.audit_status_change();

-- Outbox processing (service_role only) --------------------------------------------------
create function public.outbox_claim(p_limit integer default 50)
returns table (id uuid, topic text, aggregate_type text, aggregate_id uuid, payload jsonb, attempts integer, created_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select e.id
      from app_private.outbox_events e
     where e.processed_at is null
       and e.available_at <= now()
       and (e.locked_until is null or e.locked_until < now())
       and e.attempts < 10
     order by e.available_at
     limit greatest(1, least(coalesce(p_limit, 50), 500))
     for update skip locked
  )
  update app_private.outbox_events e
     set locked_until = now() + interval '5 minutes',
         attempts = e.attempts + 1
    from picked
   where e.id = picked.id
  returning e.id, e.topic, e.aggregate_type, e.aggregate_id, e.payload, e.attempts, e.created_at;
$$;

create function public.outbox_complete(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update app_private.outbox_events
     set processed_at = now(), locked_until = null, last_error = null
   where id = any (p_ids) and processed_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.outbox_fail(p_id uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update app_private.outbox_events
     set locked_until = null,
         last_error = left(p_error, 2000),
         available_at = now() + make_interval(mins => power(2, least(attempts, 8))::integer)
   where id = p_id and processed_at is null;
$$;

-- Function privileges ---------------------------------------------------------------------
revoke all on function public.switch_active_role(public.marketplace_role) from public, anon, authenticated;
revoke all on function public.enable_marketplace_role(public.marketplace_role) from public, anon, authenticated;
revoke all on function public.current_legal_documents() from public, anon, authenticated;
revoke all on function public.has_accepted_current_legal() from public, anon, authenticated;
revoke all on function public.accept_current_legal_documents() from public, anon, authenticated;
revoke all on function public.outbox_claim(integer) from public, anon, authenticated;
revoke all on function public.outbox_complete(uuid[]) from public, anon, authenticated;
revoke all on function public.outbox_fail(uuid, text) from public, anon, authenticated;

grant execute on function public.switch_active_role(public.marketplace_role) to authenticated;
grant execute on function public.enable_marketplace_role(public.marketplace_role) to authenticated;
grant execute on function public.current_legal_documents() to anon, authenticated;
grant execute on function public.has_accepted_current_legal() to authenticated;
grant execute on function public.accept_current_legal_documents() to authenticated;
grant execute on function public.outbox_claim(integer) to service_role;
grant execute on function public.outbox_complete(uuid[]) to service_role;
grant execute on function public.outbox_fail(uuid, text) to service_role;

revoke all on all functions in schema app_private from public, anon, authenticated;

-- The signup trigger: created last, once everything it calls exists.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();
