import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/server/db/database.types";
import type { AttachmentInfo } from "@/server/modules/attachments/service";

type Client = SupabaseClient<Database>;

export type ConversationSummary = Database["public"]["Functions"]["my_conversations"]["Returns"][number];

/** The user's conversations, newest activity first (counterpart names come from the database function). */
export async function listConversations(supabase: Client, archived = false): Promise<ConversationSummary[]> {
  const { data } = await supabase.rpc("my_conversations", { p_archived: archived });
  return data ?? [];
}

export type ThreadMessage = {
  id: string;
  mine: boolean;
  kind: string;
  body: string | null;
  state: string;
  flags: string[];
  createdAt: string;
  attachments: AttachmentInfo[];
};

/** One conversation (RLS: participants only) with its latest messages, oldest first. */
export async function getConversation(supabase: Client, userId: string, conversationId: string) {
  const { data: rows } = await supabase.rpc("my_conversations", { p_archived: null as unknown as boolean, p_conversation_id: conversationId });
  const summary = rows?.[0];
  if (!summary) return null;
  const { data: messages } = await supabase
    .from("messages")
    .select(
      "id, sender_user_id, kind, body, moderation_state, contact_flags, created_at, message_attachments (file_objects (id, display_name, size_bytes, mime_type, scan_status, owner_user_id))",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(200);
  const thread: ThreadMessage[] = (messages ?? []).reverse().map((m) => ({
    id: m.id,
    mine: m.sender_user_id === userId,
    kind: m.kind,
    body: m.moderation_state === "removed" ? null : m.body,
    state: m.moderation_state,
    flags: m.contact_flags,
    createdAt: m.created_at,
    attachments: m.message_attachments.flatMap((row) =>
      row.file_objects
        ? [
            {
              id: row.file_objects.id,
              name: row.file_objects.display_name ?? "file",
              size: row.file_objects.size_bytes,
              mime: row.file_objects.mime_type,
              scanStatus: row.file_objects.scan_status,
              mine: row.file_objects.owner_user_id === userId,
            },
          ]
        : [],
    ),
  }));
  return { summary, messages: thread };
}

export type ConversationData = NonNullable<Awaited<ReturnType<typeof getConversation>>>;
