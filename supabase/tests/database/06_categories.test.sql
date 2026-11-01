-- Category hierarchy: ltree paths follow slugs and parents; cycles and missing names are rejected.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create function pg_temp.add_category(p_id uuid, p_parent uuid, p_slug text, p_name text) returns void language sql as $$
  insert into public.categories (id, parent_id, slug) values (p_id, p_parent, p_slug);
  insert into public.category_translations (category_id, locale, name) values (p_id, 'en', p_name);
$$;
create function pg_temp.add_unnamed_category() returns void language plpgsql as $$
begin
  insert into public.categories (slug) values ('unnamed-category');
  set constraints all immediate;
end;
$$;

select pg_temp.add_category('00000000-0000-4000-8000-0000000000c1', null, 'ai-automation', 'AI automation');
select pg_temp.add_category('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c1', 'voice', 'Voice');
select pg_temp.add_category('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c2', 'phone-receptionists', 'Phone receptionists');

select is((select path::text from public.categories where id = '00000000-0000-4000-8000-0000000000c1'), 'ai_automation', 'root path comes from the slug');
select is((select path::text from public.categories where id = '00000000-0000-4000-8000-0000000000c3'), 'ai_automation.voice.phone_receptionists', 'nested paths include every ancestor');
select is((select depth from public.categories where id = '00000000-0000-4000-8000-0000000000c3'), 3::smallint, 'depth is derived from the path');

update public.categories set slug = 'automation' where id = '00000000-0000-4000-8000-0000000000c1';
select is((select path::text from public.categories where id = '00000000-0000-4000-8000-0000000000c3'), 'automation.voice.phone_receptionists', 'renaming a category updates every descendant');

select throws_ok($$ update public.categories set parent_id = '00000000-0000-4000-8000-0000000000c3' where id = '00000000-0000-4000-8000-0000000000c1' $$, '23514', null, 'a category cannot move under its own descendant');
select throws_ok($$ insert into public.categories (parent_id, slug) values ('00000000-0000-4000-8000-0000000000c1', 'voice') $$, '23505', null, 'sibling slugs are unique');
select throws_ok($$ insert into public.categories (slug) values ('automation') $$, '23505', null, 'top-level slugs are unique too');
select throws_ok($$ select pg_temp.add_unnamed_category() $$, '23514', null, 'a category needs an English name');

update public.categories set parent_id = null where id = '00000000-0000-4000-8000-0000000000c2';
select is((select path::text from public.categories where id = '00000000-0000-4000-8000-0000000000c3'), 'voice.phone_receptionists', 'moving a subtree rewrites its paths');

update public.categories set is_active = false where id = '00000000-0000-4000-8000-0000000000c2';
set local role anon;
select is((select count(*)::int from public.categories where id = '00000000-0000-4000-8000-0000000000c2'), 0, 'inactive categories are hidden from visitors');

select * from finish();
rollback;
