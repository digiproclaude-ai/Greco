-- Cover the message foreign key on contact policy events (performance advisor).
create index contact_policy_events_message_idx on app_private.contact_policy_events (message_id) where message_id is not null;
