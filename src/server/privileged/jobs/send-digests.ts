import "server-only";

import { getEmailProvider } from "@/server/adapters/email";
import { log } from "@/server/log";
import { renderDigestEmail } from "@/server/modules/notifications/email";

import { createSupabaseAdminClient } from "../supabase-admin";

/** Email people who have had unread messages for over an hour (at most every 12 hours). */
export async function sendUnreadDigests() {
  const provider = getEmailProvider();
  if (!provider) return { sent: 0, skipped: "email not configured" };
  const supabase = createSupabaseAdminClient();
  const { data: candidates, error } = await supabase.rpc("unread_digest_candidates", { p_min_age_minutes: 60, p_limit: 100 });
  if (error) throw new Error(`unread_digest_candidates failed: ${error.message}`);

  let sent = 0;
  let failed = 0;
  for (const candidate of candidates ?? []) {
    const email = await renderDigestEmail({
      name: candidate.name ?? "",
      locale: candidate.locale,
      conversations: Number(candidate.unread_conversations),
    });
    try {
      await provider.send({
        to: candidate.email,
        ...email,
        tags: { type: "messages.unread_digest" },
        idempotencyKey: `digest-${candidate.user_id}-${new Date().toISOString().slice(0, 13)}`,
      });
      await supabase.rpc("unread_digest_mark_sent", { p_user_id: candidate.user_id });
      sent += 1;
    } catch (sendError) {
      failed += 1;
      log.warn("digest.send_failed", { error: sendError instanceof Error ? sendError.message : String(sendError) });
    }
  }
  return { sent, failed };
}
