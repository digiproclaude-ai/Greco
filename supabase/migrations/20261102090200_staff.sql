-- Staff functions: moderation decisions, suspensions, categories and taxonomy.
-- They run as the signed-in staff member (no service-role key needed), require MFA (aal2) via
-- app.is_staff, and write the audit log. See SECURITY.md §9 and IMPLEMENTATION_PLAN.md Phase 3.

create function app_private.require_staff(p_roles public.staff_role[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_staff(p_roles) then
    raise exception 'staff role with two-step verification required' using errcode = '42501';
  end if;
end;
$$;

-- Moderation -------------------------------------------------------------------------------------
create function public.admin_review(p_request_id uuid, p_decision text, p_reason text default null)
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
end;
$$;

-- suspend | reinstate a provider or a listing.
create function public.admin_set_status(p_target_type text, p_target_id uuid, p_action text, p_reason text default null)
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
end;
$$;

-- Categories ---------------------------------------------------------------------------------------
create function public.admin_save_category(
  p_id uuid,
  p_parent_id uuid,
  p_slug text,
  p_name text,
  p_short_description text default null,
  p_description text default null,
  p_icon_key text default null,
  p_sort_order integer default 0,
  p_is_visible boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_before jsonb;
begin
  perform app_private.require_staff(array['super_admin', 'admin']::public.staff_role[]);
  if char_length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'name required' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.categories (parent_id, slug, icon_key, sort_order, is_visible)
    values (p_parent_id, lower(btrim(p_slug)), nullif(p_icon_key, ''), coalesce(p_sort_order, 0), coalesce(p_is_visible, true))
    returning id into v_id;
  else
    select to_jsonb(c) into v_before from public.categories c where c.id = v_id;
    if v_before is null then
      raise exception 'category not found' using errcode = '22023';
    end if;
    update public.categories
       set parent_id = p_parent_id, slug = lower(btrim(p_slug)), icon_key = nullif(p_icon_key, ''),
           sort_order = coalesce(p_sort_order, 0), is_visible = coalesce(p_is_visible, true)
     where id = v_id;
  end if;

  insert into public.category_translations (category_id, locale, name, short_description, description)
  values (v_id, 'en', btrim(p_name), nullif(btrim(p_short_description), ''), nullif(btrim(p_description), ''))
  on conflict (category_id, locale) do update
    set name = excluded.name, short_description = excluded.short_description, description = excluded.description;

  perform app_private.write_audit(case when p_id is null then 'category.created' else 'category.updated' end,
    'category', v_id::text, v_before, (select to_jsonb(c) from public.categories c where c.id = v_id));
  perform app_private.refresh_all_search_documents();
  return v_id;
end;
$$;

-- Deactivating hides the category and its subtree from new listings and navigation; existing
-- listings keep their link until reassigned.
create function public.admin_set_category_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path extensions.ltree;
begin
  perform app_private.require_staff(array['super_admin', 'admin']::public.staff_role[]);
  select path into v_path from public.categories where id = p_id;
  if v_path is null then
    raise exception 'category not found' using errcode = '22023';
  end if;
  if p_active then
    if exists (select 1 from public.categories c join public.categories child on child.parent_id = c.id
                where child.id = p_id and not c.is_active) then
      raise exception 'activate the parent category first' using errcode = '55000';
    end if;
    update public.categories set is_active = true where id = p_id;
  else
    update public.categories set is_active = false where path operator(extensions.<@) v_path;
  end if;
  perform app_private.write_audit(case when p_active then 'category.activated' else 'category.deactivated' end,
    'category', p_id::text);
end;
$$;

create function public.admin_reassign_category_listings(p_from uuid, p_to uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform app_private.require_staff(array['super_admin', 'admin']::public.staff_role[]);
  if not exists (select 1 from public.categories where id = p_to and is_active) then
    raise exception 'target category must be active' using errcode = '22023';
  end if;
  perform set_config('greco.system_change', 'on', true);
  update public.service_listings set primary_category_id = p_to where primary_category_id = p_from;
  get diagnostics v_count = row_count;
  delete from public.service_listing_categories where category_id = p_from;
  perform set_config('greco.system_change', 'off', true);
  perform app_private.write_audit('category.listings_reassigned', 'category', p_from::text, null,
    jsonb_build_object('to', p_to, 'count', v_count));
  return v_count;
end;
$$;

-- Taxonomy ----------------------------------------------------------------------------------------
create function public.admin_save_term(
  p_id uuid,
  p_kind public.term_kind,
  p_slug text,
  p_name text,
  p_description text default null,
  p_aliases text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_alias text;
begin
  perform app_private.require_staff(array['super_admin', 'admin', 'moderator']::public.staff_role[]);
  if char_length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'name required' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.taxonomy_terms (kind, slug, status) values (p_kind, lower(btrim(p_slug)), 'active')
    returning id into v_id;
  else
    update public.taxonomy_terms set kind = p_kind, slug = lower(btrim(p_slug)) where id = v_id;
    if not found then
      raise exception 'term not found' using errcode = '22023';
    end if;
  end if;

  insert into public.taxonomy_term_translations (term_id, locale, name, description)
  values (v_id, 'en', btrim(p_name), nullif(btrim(p_description), ''))
  on conflict (term_id, locale) do update set name = excluded.name, description = excluded.description;

  delete from public.taxonomy_term_aliases where term_id = v_id;
  foreach v_alias in array coalesce(p_aliases, '{}') loop
    if char_length(btrim(v_alias)) > 0 then
      insert into public.taxonomy_term_aliases (term_id, alias, locale) values (v_id, btrim(v_alias), 'en')
      on conflict do nothing;
    end if;
  end loop;

  perform app_private.write_audit(case when p_id is null then 'term.created' else 'term.updated' end, 'term', v_id::text);
  perform app_private.refresh_all_search_documents();
  return v_id;
end;
$$;

-- active | retired (approving a suggestion = setting it active)
create function public.admin_set_term_status(p_id uuid, p_status public.term_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.require_staff(array['super_admin', 'admin', 'moderator']::public.staff_role[]);
  if p_status not in ('active', 'retired') then
    raise exception 'use admin_merge_term to merge' using errcode = '22023';
  end if;
  update public.taxonomy_terms set status = p_status where id = p_id and status <> 'merged';
  if not found then
    raise exception 'term not found or already merged' using errcode = '55000';
  end if;
  perform app_private.write_audit('term.status_changed', 'term', p_id::text, null, jsonb_build_object('status', p_status));
end;
$$;

create function public.admin_merge_term(p_from uuid, p_into uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.require_staff(array['super_admin', 'admin', 'moderator']::public.staff_role[]);
  if p_from = p_into or not exists (select 1 from public.taxonomy_terms where id = p_into and status = 'active') then
    raise exception 'merge into a different, active term' using errcode = '22023';
  end if;

  perform set_config('greco.system_change', 'on', true);
  insert into public.provider_terms (provider_id, term_id, years, is_featured)
    select provider_id, p_into, years, is_featured from public.provider_terms where term_id = p_from
  on conflict do nothing;
  delete from public.provider_terms where term_id = p_from;
  insert into public.service_listing_terms (listing_id, term_id)
    select listing_id, p_into from public.service_listing_terms where term_id = p_from
  on conflict do nothing;
  delete from public.service_listing_terms where term_id = p_from;
  insert into public.portfolio_item_terms (item_id, term_id)
    select item_id, p_into from public.portfolio_item_terms where term_id = p_from
  on conflict do nothing;
  delete from public.portfolio_item_terms where term_id = p_from;
  insert into public.category_terms (category_id, term_id, weight)
    select category_id, p_into, weight from public.category_terms where term_id = p_from
  on conflict do nothing;
  delete from public.category_terms where term_id = p_from;
  -- The old name keeps working as a synonym.
  insert into public.taxonomy_term_aliases (term_id, alias, locale)
    select p_into, tt.name, 'en' from public.taxonomy_term_translations tt where tt.term_id = p_from and tt.locale = 'en'
  on conflict do nothing;
  update public.taxonomy_term_aliases set term_id = p_into where term_id = p_from;
  update public.taxonomy_terms set status = 'merged', merged_into_id = p_into where id = p_from;
  perform set_config('greco.system_change', 'off', true);

  perform app_private.write_audit('term.merged', 'term', p_from::text, null, jsonb_build_object('into', p_into));
  perform app_private.refresh_all_search_documents();
end;
$$;

-- Privileges --------------------------------------------------------------------------------------
revoke all on function public.admin_review(uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_set_status(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_save_category(uuid, uuid, text, text, text, text, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.admin_set_category_active(uuid, boolean) from public, anon, authenticated;
revoke all on function public.admin_reassign_category_listings(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_save_term(uuid, public.term_kind, text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.admin_set_term_status(uuid, public.term_status) from public, anon, authenticated;
revoke all on function public.admin_merge_term(uuid, uuid) from public, anon, authenticated;

-- Callable by signed-in users; each function checks the staff role and MFA itself.
grant execute on function public.admin_review(uuid, text, text) to authenticated;
grant execute on function public.admin_set_status(text, uuid, text, text) to authenticated;
grant execute on function public.admin_save_category(uuid, uuid, text, text, text, text, text, integer, boolean) to authenticated;
grant execute on function public.admin_set_category_active(uuid, boolean) to authenticated;
grant execute on function public.admin_reassign_category_listings(uuid, uuid) to authenticated;
grant execute on function public.admin_save_term(uuid, public.term_kind, text, text, text, text[]) to authenticated;
grant execute on function public.admin_set_term_status(uuid, public.term_status) to authenticated;
grant execute on function public.admin_merge_term(uuid, uuid) to authenticated;

revoke all on all functions in schema app_private from public, anon, authenticated;
