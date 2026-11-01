-- Structural security guarantees that must hold for every table and function.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select is(
  (select coalesce(array_agg(tablename::text order by tablename), '{}')
     from pg_tables where schemaname = 'public' and not rowsecurity),
  '{}'::text[],
  'every public table has row level security enabled'
);

select is(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and (has_table_privilege('anon', c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
           or has_any_column_privilege('anon', c.oid, 'INSERT, UPDATE'))),
  '{}'::text[],
  'anon cannot write to any public table'
);

select ok(not has_schema_privilege('authenticated', 'app_private', 'USAGE'), 'authenticated cannot use app_private');
select ok(not has_schema_privilege('anon', 'app_private', 'USAGE'), 'anon cannot use app_private');

select is(
  (select coalesce(array_agg(p.oid::regprocedure::text order by 1), '{}')
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app', 'app_private')
      and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  '{}'::text[],
  'every security definer function pins its search_path'
);

select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  array['current_legal_documents'],
  'anon can only execute whitelisted public functions'
);

select * from finish();
rollback;
