-- Development seed data (local Supabase and CI only). Production categories are created by
-- admins in the admin area (Phase 3); these are placeholders for development.
-- One transaction: each category needs its English name by commit time.
begin;

insert into public.categories (id, slug, icon_key, sort_order) values
  ('00000000-0000-4000-8000-000000000101', 'ai-agents-automation', 'bot', 10),
  ('00000000-0000-4000-8000-000000000102', 'chatbots-assistants', 'message-square', 20),
  ('00000000-0000-4000-8000-000000000103', 'voice-agents', 'phone', 30),
  ('00000000-0000-4000-8000-000000000104', 'data-science-analytics', 'chart-column', 40)
on conflict do nothing;

insert into public.category_translations (category_id, locale, name, short_description) values
  ('00000000-0000-4000-8000-000000000101', 'en', 'AI agents & automation', 'Agents that run multi-step work across your tools'),
  ('00000000-0000-4000-8000-000000000102', 'en', 'Chatbots & assistants', 'Support and internal assistants grounded in your data'),
  ('00000000-0000-4000-8000-000000000103', 'en', 'Voice agents & phone', 'Answer, route and book calls automatically'),
  ('00000000-0000-4000-8000-000000000104', 'en', 'Data science & analytics', 'Forecasting, dashboards and decision models')
on conflict do nothing;

commit;
