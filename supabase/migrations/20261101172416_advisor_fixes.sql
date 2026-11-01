-- Follow-ups from the Supabase database advisors after the first deploy.

-- These two only read rows the caller may already read under RLS, so they don't need
-- elevated rights. (switch_active_role, enable_marketplace_role and
-- accept_current_legal_documents stay SECURITY DEFINER: they write rows users cannot
-- write directly, and each checks auth.uid() itself.)
alter function public.current_legal_documents() security invoker;
alter function public.has_accepted_current_legal() security invoker;

-- Cover foreign keys used for joins and ON DELETE handling.
create index platform_settings_updated_by_idx on public.platform_settings (updated_by) where updated_by is not null;
create index profiles_avatar_file_idx on public.profiles (avatar_file_id) where avatar_file_id is not null;
create index staff_roles_granted_by_idx on public.staff_roles (granted_by) where granted_by is not null;
create index taxonomy_terms_suggested_by_idx on public.taxonomy_terms (suggested_by) where suggested_by is not null;
