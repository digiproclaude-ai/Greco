-- Platform configuration: settings with history, and feature flags. See DATABASE_SCHEMA.md §12.
-- Commission policies arrive with the payments module (Phase 6).

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  value jsonb not null,
  description text not null,
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table app_private.platform_settings_history (
  id bigint generated always as identity primary key,
  key text not null,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create function app_private.platform_settings_track()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into app_private.platform_settings_history (key, old_value, new_value, changed_by)
    values (new.key, null, new.value, auth.uid());
    perform app_private.write_audit('platform.setting_created', 'platform_setting', new.key, null, to_jsonb(new));
  elsif new.value is distinct from old.value then
    insert into app_private.platform_settings_history (key, old_value, new_value, changed_by)
    values (new.key, old.value, new.value, auth.uid());
    perform app_private.write_audit('platform.setting_updated', 'platform_setting', new.key, to_jsonb(old), to_jsonb(new));
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger platform_settings_track
  before insert or update on public.platform_settings
  for each row execute function app_private.platform_settings_track();

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  enabled boolean not null default false,
  description text not null,
  is_public boolean not null default false,
  rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger feature_flags_set_updated_at before update on public.feature_flags
  for each row execute function extensions.moddatetime(updated_at);

revoke all on all tables in schema app_private from public, anon, authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;
