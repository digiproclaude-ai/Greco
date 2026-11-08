import "server-only";

import { z } from "zod";

import { getEmailProvider } from "@/server/adapters/email";
import { log } from "@/server/log";
import { renderNotificationEmail } from "@/server/modules/notifications/email";

import { createSupabaseAdminClient } from "../supabase-admin";

const payloadSchema = z.object({
  id: z.uuid(),
  email: z.string().min(3),
  locale: z.string().nullable(),
  name: z.string().nullable(),
  type: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  params: z.unknown(),
  count: z.number().int(),
});

/** Email one notification if the user wants email for its type. Called from the outbox. */
export async function sendNotificationEmail(notificationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("notification_email_payload", { p_notification_id: notificationId });
  if (error) throw new Error(`notification_email_payload failed: ${error.message}`);
  if (!data) return; // No email wanted, or already sent.
  const payload = payloadSchema.parse(data);

  const provider = getEmailProvider();
  if (!provider) {
    await supabase.rpc("notification_record_delivery", { p_notification_id: payload.id, p_status: "skipped", p_error: "email not configured" });
    log.info("email.skipped_not_configured", { type: payload.type });
    return;
  }

  const email = await renderNotificationEmail({
    type_key: payload.type,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    params: payload.params,
    count: payload.count,
    name: payload.name ?? "",
    locale: payload.locale,
  });
  try {
    const sent = await provider.send({
      to: payload.email,
      ...email,
      tags: { type: payload.type },
      idempotencyKey: `notification-${payload.id}`,
    });
    await supabase.rpc("notification_record_delivery", {
      p_notification_id: payload.id,
      p_status: "sent",
      p_provider_ref: sent.providerMessageId,
    });
  } catch (sendError) {
    await supabase.rpc("notification_record_delivery", {
      p_notification_id: payload.id,
      p_status: "failed",
      p_error: sendError instanceof Error ? sendError.message : "send failed",
    });
    throw sendError;
  }
}
