-- Projects, invitations and proposals: visibility, checklists, decisions and notifications.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

create function pg_temp.new_user(p_email text, p_meta jsonb) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, aud, role)
  values (v_id, p_email, p_meta, now(), 'authenticated', 'authenticated');
  return v_id;
end;
$$;
create function pg_temp.login(p_user uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
end;
$$;
create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create temp table ids (name text primary key, id uuid not null);
grant select on ids to public;
insert into ids values
  ('c', pg_temp.new_user('client-p@test.local', '{"full_name": "Clara Client", "initial_role": "client"}')),
  ('o', pg_temp.new_user('other-p@test.local', '{"full_name": "Oscar Other", "initial_role": "client"}')),
  ('e1', pg_temp.new_user('expert1-p@test.local', '{"full_name": "Ema Expert", "initial_role": "expert"}')),
  ('e2', pg_temp.new_user('expert2-p@test.local', '{"full_name": "Eli Draft", "initial_role": "expert"}')),
  ('mod', pg_temp.new_user('mod-p@test.local', '{"full_name": "Mo Moderator", "initial_role": "client"}'));
insert into ids select 'p1', id from public.providers where owner_user_id = (select id from ids where name = 'e1');
insert into ids select 'p2', id from public.providers where owner_user_id = (select id from ids where name = 'e2');
update public.providers set status = 'active', published_at = now() where id = (select id from ids where name = 'p1');
insert into public.staff_roles (user_id, role) values ((select id from ids where name = 'mod'), 'moderator');
insert into ids values ('pr', '00000000-0000-4000-8000-0000000000f1'), ('inv', '00000000-0000-4000-8000-0000000000f2');

-- Creating and publishing ------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'c'));
select lives_ok($$
  insert into public.projects (id, client_user_id, title, budget_kind, currency, budget_max_minor)
  values ('00000000-0000-4000-8000-0000000000f1', (select id from ids where name = 'c'), 'Voice agent for our clinics', 'fixed', 'EUR', 500000)
$$, 'clients create draft projects');

select pg_temp.login((select id from ids where name = 'e1'));
select throws_ok($$
  insert into public.projects (client_user_id, title) values ((select id from ids where name = 'e1'), 'Experts cannot post projects')
$$, '42501', null, 'experts without the client role cannot post projects');
select is((select count(*)::int from public.projects where id = (select id from ids where name = 'pr')), 0, 'drafts are private');

select pg_temp.login((select id from ids where name = 'c'));
select is(public.projects_publish((select id from ids where name = 'pr')), array['description', 'category'],
  'publishing reports what is missing');
update public.projects
   set description = repeat('We run three dental clinics and miss calls at lunchtime. ', 3),
       category_id = (select id from public.categories where slug = 'ai-receptionists')
 where id = (select id from ids where name = 'pr');
select is(public.projects_publish((select id from ids where name = 'pr')), '{}'::text[], 'a complete project is published');
select is((select status::text from public.projects where id = (select id from ids where name = 'pr')), 'open', 'the project is open');
select ok((select expires_at > now() + interval '29 days' from public.projects where id = (select id from ids where name = 'pr')),
  'open projects expire after 30 days');

-- Visibility ------------------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'e1'));
select is((select count(*)::int from public.projects where id = (select id from ids where name = 'pr')), 1, 'experts see open public projects');
select pg_temp.login((select id from ids where name = 'o'));
select is((select count(*)::int from public.projects where id = (select id from ids where name = 'pr')), 0, 'other clients do not');
select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$ select count(*) from public.projects $$, '42501', null, 'anonymous visitors cannot read projects');

-- Proposals ---------------------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'e1'));
select lives_ok($$
  insert into public.proposals (id, project_id, provider_id, submitted_by_user_id, proposed_solution, currency, price_minor, estimated_days)
  values ('00000000-0000-4000-8000-0000000000f3', (select id from ids where name = 'pr'), (select id from ids where name = 'p1'),
          (select id from ids where name = 'e1'), 'Short pitch', 'EUR', 450000, 21)
$$, 'experts draft proposals on open projects');
select is(public.proposals_submit('00000000-0000-4000-8000-0000000000f3'), array['solution'], 'submitting reports what is missing');

select pg_temp.login((select id from ids where name = 'c'));
select is((select count(*)::int from public.proposals where project_id = (select id from ids where name = 'pr')), 0,
  'clients do not see draft proposals');

select pg_temp.login((select id from ids where name = 'e1'));
update public.proposals set proposed_solution = repeat('I will build and tune a voice agent that books into your calendar. ', 3)
 where id = '00000000-0000-4000-8000-0000000000f3';
insert into public.proposal_milestones (proposal_id, seq, title, amount_minor, due_offset_days) values
  ('00000000-0000-4000-8000-0000000000f3', 1, 'Prototype', 200000, 7),
  ('00000000-0000-4000-8000-0000000000f3', 2, 'Go live', 200000, 21);
select is(public.proposals_submit('00000000-0000-4000-8000-0000000000f3'), array['milestones'],
  'milestones must add up to the price');
update public.proposal_milestones set amount_minor = 250000 where proposal_id = '00000000-0000-4000-8000-0000000000f3' and seq = 2;
update public.proposals set payment_model = 'deposit', deposit_bps = 3000, balance_trigger = 'on_milestone_acceptance'
 where id = '00000000-0000-4000-8000-0000000000f3';
select is(public.proposals_submit('00000000-0000-4000-8000-0000000000f3'), '{}'::text[], 'a complete proposal is submitted');
update public.proposals set price_minor = 1 where id = '00000000-0000-4000-8000-0000000000f3';
select is((select price_minor from public.proposals where id = '00000000-0000-4000-8000-0000000000f3'), 450000::bigint,
  'submitted proposals cannot be edited');

select pg_temp.as_owner();
select is((select proposals_count from public.projects where id = (select id from ids where name = 'pr')), 1, 'the project counts live proposals');
select is((select count(*)::int from public.notifications where user_id = (select id from ids where name = 'c') and type_key = 'proposal.received'), 1,
  'the client is notified');

select pg_temp.login((select id from ids where name = 'c'));
select is((select status::text from public.proposals where id = '00000000-0000-4000-8000-0000000000f3'), 'submitted', 'clients see submitted proposals');
select is((select count(*)::int from public.proposal_milestones where proposal_id = '00000000-0000-4000-8000-0000000000f3'), 2,
  'and their milestones');

-- An expert whose profile is not approved yet.
select pg_temp.login((select id from ids where name = 'e2'));
insert into public.proposals (id, project_id, provider_id, submitted_by_user_id, proposed_solution, currency, price_minor, estimated_days)
values ('00000000-0000-4000-8000-0000000000f4', (select id from ids where name = 'pr'), (select id from ids where name = 'p2'),
        (select id from ids where name = 'e2'), repeat('A thorough plan for your clinics. ', 5), 'EUR', 300000, 14);
select ok('profile_approved' = any (public.proposals_submit('00000000-0000-4000-8000-0000000000f4')),
  'experts need an approved profile to submit');

-- Decisions -----------------------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'o'));
select throws_ok($$ select public.proposals_decide('00000000-0000-4000-8000-0000000000f3', 'shortlist') $$, '42501', null,
  'only the project owner decides');
select pg_temp.login((select id from ids where name = 'c'));
select is(public.proposals_decide('00000000-0000-4000-8000-0000000000f3', 'shortlist')::text, 'shortlisted', 'clients shortlist proposals');
select pg_temp.as_owner();
select is((select count(*)::int from public.notifications where user_id = (select id from ids where name = 'e1') and type_key = 'proposal.shortlisted'), 1,
  'the expert is told about the shortlist');

select pg_temp.login((select id from ids where name = 'e1'));
select lives_ok($$ select public.proposals_withdraw('00000000-0000-4000-8000-0000000000f3') $$, 'experts withdraw their proposals');
select pg_temp.as_owner();
select is((select proposals_count from public.projects where id = (select id from ids where name = 'pr')), 0, 'withdrawn proposals stop counting');

-- Invitations and invite-only projects ------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'c'));
select throws_ok($$ select public.projects_invite((select id from ids where name = 'pr'), (select id from ids where name = 'p2')) $$, '22023', null,
  'only approved experts can be invited');
update public.projects set visibility = 'invite_only' where id = (select id from ids where name = 'pr');
select lives_ok($$ select public.projects_invite((select id from ids where name = 'pr'), (select id from ids where name = 'p1'), 'Would love your view.') $$,
  'clients invite approved experts');
select throws_ok($$ select public.projects_invite((select id from ids where name = 'pr'), (select id from ids where name = 'p1')) $$, '23505', null,
  'an expert is invited once');

select pg_temp.login((select id from ids where name = 'e2'));
select is((select count(*)::int from public.projects where id = (select id from ids where name = 'pr')), 1,
  'experts who proposed still see the project');
select pg_temp.as_owner();
delete from public.proposals where id = '00000000-0000-4000-8000-0000000000f4';
select pg_temp.login((select id from ids where name = 'e2'));
select is((select count(*)::int from public.projects where id = (select id from ids where name = 'pr')), 0,
  'uninvited experts do not see invite-only projects');
select pg_temp.login((select id from ids where name = 'e1'));
select is((select count(*)::int from public.projects where id = (select id from ids where name = 'pr')), 1, 'invited experts do');

-- Closing and moderation ------------------------------------------------------------------------------------------
select pg_temp.login((select id from ids where name = 'c'));
select is(public.projects_change_status((select id from ids where name = 'pr'), 'close')::text, 'closed', 'clients close projects');
select pg_temp.login((select id from ids where name = 'e1'));
select throws_ok($$
  insert into public.proposals (project_id, provider_id, submitted_by_user_id, proposed_solution)
  values ((select id from ids where name = 'pr'), (select id from ids where name = 'p1'), (select id from ids where name = 'e1'), 'Late')
$$, '42501', null, 'closed projects take no proposals');
select throws_ok($$ select public.admin_set_project_status((select id from ids where name = 'pr'), 'remove', 'Contains phone numbers.') $$, '42501', null,
  'experts cannot remove projects');
select pg_temp.login((select id from ids where name = 'mod'), 'aal2');
select lives_ok($$ select public.admin_set_project_status((select id from ids where name = 'pr'), 'remove', 'Contains contact details, which is not allowed.') $$,
  'moderators remove projects with a statement of reasons');

select * from finish();
rollback;
