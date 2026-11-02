-- Row limits on expert profile children (languages, links).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, aud, role)
values ('00000000-0000-4000-8000-00000000a101', 'limits@test.local',
        '{"full_name": "Lia Limits", "initial_role": "expert"}', now(), 'authenticated', 'authenticated');

create temp table ids as
  select id as provider_id from public.providers where owner_user_id = '00000000-0000-4000-8000-00000000a101';

insert into public.provider_languages (provider_id, language_code, proficiency)
select (select provider_id from ids), code, 'fluent'
  from unnest(array['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ro', 'sv']) code;
select is((select count(*)::int from public.provider_languages where provider_id = (select provider_id from ids)), 10,
  'ten languages can be added');

select throws_ok(
  $$insert into public.provider_languages (provider_id, language_code, proficiency)
    values ((select provider_id from ids), 'fi', 'basic')$$,
  '23514', null, 'an eleventh language is rejected');

insert into public.provider_links (provider_id, kind, url)
select (select provider_id from ids), 'website', 'https://example.com/' || n from generate_series(1, 8) n;
select throws_ok(
  $$insert into public.provider_links (provider_id, kind, url)
    values ((select provider_id from ids), 'website', 'https://example.com/9')$$,
  '23514', null, 'a ninth link is rejected');

drop table ids;
select * from finish();
rollback;
