import "server-only";

import { log } from "@/server/log";

import { createSupabaseAdminClient } from "../supabase-admin";

type OutboxEvent = {
  id: string;
  topic: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  attempts: number;
};

type Handler = (event: OutboxEvent) => Promise<void>;

/**
 * Side-effect handlers by topic. Phase 2 events have no side effects yet: notifications,
 * emails and search reindexing subscribe here in later phases.
 */
const handlers: Record<string, Handler> = {
  "identity.user_registered": async () => {},
  "identity.role_enabled": async () => {},
  "provider.status_changed": async () => {},
};

export async function processOutbox(batchSize = 50) {
  const supabase = createSupabaseAdminClient();
  const { data: events, error } = await supabase.rpc("outbox_claim", { p_limit: batchSize });
  if (error) throw new Error(`outbox_claim failed: ${error.message}`);

  const done: string[] = [];
  let failed = 0;
  for (const event of (events ?? []) as OutboxEvent[]) {
    const handler = handlers[event.topic];
    try {
      if (!handler) {
        log.warn("outbox.unknown_topic", { topic: event.topic, id: event.id });
      } else {
        await handler(event);
      }
      done.push(event.id);
    } catch (handlerError) {
      failed += 1;
      log.error("outbox.handler_failed", { topic: event.topic, id: event.id, error: handlerError });
      await supabase.rpc("outbox_fail", {
        p_id: event.id,
        p_error: handlerError instanceof Error ? handlerError.message : String(handlerError),
      });
    }
  }

  if (done.length > 0) {
    const { error: completeError } = await supabase.rpc("outbox_complete", { p_ids: done });
    if (completeError) throw new Error(`outbox_complete failed: ${completeError.message}`);
  }
  return { claimed: events?.length ?? 0, processed: done.length, failed };
}
