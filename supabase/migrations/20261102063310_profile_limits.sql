-- Upper bounds on rows per expert profile and portfolio item, matching the editors' limits.
-- TG_ARGV[0] = the column that identifies the parent, TG_ARGV[1] = maximum rows.
create function app_private.enforce_child_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent uuid;
  v_count integer;
begin
  execute format('select ($1).%I', tg_argv[0]) into v_parent using new;
  execute format('select count(*) from public.%I where %I = $1', tg_table_name, tg_argv[0])
    into v_count using v_parent;
  if v_count > tg_argv[1]::integer then
    raise exception 'too many rows in % (maximum %)', tg_table_name, tg_argv[1]
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create trigger provider_terms_limit after insert on public.provider_terms
  for each row execute function app_private.enforce_child_limit('provider_id', '20');
create trigger provider_languages_limit after insert on public.provider_languages
  for each row execute function app_private.enforce_child_limit('provider_id', '10');
create trigger provider_links_limit after insert on public.provider_links
  for each row execute function app_private.enforce_child_limit('provider_id', '8');
create trigger portfolio_items_limit after insert on public.portfolio_items
  for each row execute function app_private.enforce_child_limit('provider_id', '30');
create trigger portfolio_item_terms_limit after insert on public.portfolio_item_terms
  for each row execute function app_private.enforce_child_limit('item_id', '10');
create trigger portfolio_item_media_limit after insert on public.portfolio_item_media
  for each row execute function app_private.enforce_child_limit('item_id', '8');

revoke all on function app_private.enforce_child_limit() from public, anon, authenticated;
