"use server";

import { getLocale } from "next-intl/server";
import { refresh } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { log } from "@/server/log";
import { discardPrivateFile, uploadPrivateFile } from "@/server/modules/attachments/service";
import { echo, failed, succeeded, type ActionState } from "@/server/modules/shared/action-state";
import { clientContext, expertContext, userContext } from "@/server/modules/shared/context";
import { dbErrorKey } from "@/server/modules/shared/db-errors";
import { toFieldErrors } from "@/server/modules/shared/validation";

import { MAX_MESSAGE_FILES, messageSchema, REPORT_TARGETS, reportSchema, type ReportTarget } from "./schemas";

const UUID = /^[0-9a-f-]{36}$/i;
const optionalUuid = (value: string | null | undefined) => (value && UUID.test(value) ? value : undefined);

export type ContactTarget = { providerId: string; projectId?: string | null; listingId?: string | null; returnTo?: string };

/** A client opens (or reopens) the conversation with an expert, then goes to it. */
export async function contactExpertAction(target: ContactTarget): Promise<ActionState> {
  const locale = await getLocale();
  const ctx = await userContext();
  if (!ctx) {
    const next = safeNextPath(target.returnTo, "/dashboard/messages");
    return redirect({ href: `/login?next=${encodeURIComponent(next)}`, locale });
  }
  if (!UUID.test(target.providerId)) return failed("invalid");
  if (!(await clientContext())) return failed("needsClientRole");
  const { data: id, error } = await ctx.supabase.rpc("conversations_open", {
    p_provider_id: target.providerId,
    p_context_project_id: optionalUuid(target.projectId),
    p_context_listing_id: optionalUuid(target.listingId),
  });
  if (error || !id) {
    log.warn("messaging.open_failed", { code: error?.code });
    return failed(error?.message === "blocked" ? "blocked" : error?.message === "you cannot message yourself" ? "ownProfile" : dbErrorKey(error));
  }
  return redirect({ href: `/dashboard/messages/${id}`, locale });
}

/** An expert opens the conversation with a client about a project they were invited to or proposed on. */
export async function contactClientAction(clientUserId: string, projectId: string): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx || !UUID.test(clientUserId) || !UUID.test(projectId)) return failed("notAllowed");
  const { data: id, error } = await ctx.supabase.rpc("conversations_open", {
    p_client_user_id: clientUserId,
    p_context_project_id: projectId,
  });
  if (error || !id) return failed(error?.message === "blocked" ? "blocked" : dbErrorKey(error));
  return redirect({ href: `/dashboard/messages/${id}`, locale: await getLocale() });
}

/** Send a message with up to five attachments. The database applies the contact policy (A-13). */
export async function sendMessageAction(conversationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await userContext();
  if (!ctx || !UUID.test(conversationId)) return failed("notAllowed");
  const values = echo(formData, ["body"]);
  const parsed = messageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });

  const files = formData.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
  if (!parsed.data.body && files.length === 0) return failed("emptyMessage", { values });
  if (files.length > MAX_MESSAGE_FILES) return failed("tooManyFiles", { errorValues: { max: MAX_MESSAGE_FILES }, values });

  // Relationship check before uploading anything: the user takes part in this conversation.
  const { data: participant } = await ctx.supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!participant) return failed("notAllowed");

  const fileIds: string[] = [];
  for (const file of files) {
    const upload = await uploadPrivateFile(ctx, file, "message_attachment");
    if ("failure" in upload) {
      for (const id of fileIds) await discardPrivateFile(ctx, id);
      return { ...upload.failure, values };
    }
    fileIds.push(upload.fileId);
  }

  const { data, error } = await ctx.supabase.rpc("messages_send", {
    p_conversation_id: conversationId,
    p_body: parsed.data.body ?? "",
    p_file_ids: fileIds,
  });
  if (error) {
    for (const id of fileIds) await discardPrivateFile(ctx, id);
    if (error.message === "slow down") return failed("slowDown", { values });
    if (error.message === "blocked") return failed("blocked", { values });
    log.warn("messaging.send_failed", { code: error.code });
    return failed(dbErrorKey(error), { values });
  }
  const result = data as { masked?: boolean; signals?: string[] } | null;
  const signals = result?.signals ?? [];
  refresh();
  if (result?.masked) return succeeded("sentMasked");
  if (signals.includes("secret")) return succeeded("sentSecret");
  if (signals.includes("payment_offsite")) return succeeded("sentOffsite");
  return succeeded("sent");
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  const ctx = await userContext();
  if (!ctx || !UUID.test(conversationId)) return;
  const { error } = await ctx.supabase.rpc("conversations_mark_read", { p_conversation_id: conversationId });
  if (error) log.warn("messaging.mark_read_failed", { code: error.code });
}

/** Mute, unmute, archive or unarchive the conversation for the current user only. */
export async function updateConversationAction(conversationId: string, formData: FormData): Promise<void> {
  const ctx = await userContext();
  if (!ctx || !UUID.test(conversationId)) return;
  const action = String(formData.get("action") ?? "");
  const changes: Record<string, { muted?: boolean; archived_at?: string | null }> = {
    mute: { muted: true },
    unmute: { muted: false },
    archive: { archived_at: new Date().toISOString() },
    unarchive: { archived_at: null },
  };
  const change = changes[action];
  if (!change) return;
  const { error } = await ctx.supabase
    .from("conversation_participants")
    .update(change)
    .eq("conversation_id", conversationId)
    .eq("user_id", ctx.userId);
  if (error) log.warn("messaging.update_failed", { action, code: error.code });
  if (action === "archive") return redirect({ href: "/dashboard/messages", locale: await getLocale() });
  refresh();
}

/** Block or unblock the other person in a conversation. */
export async function blockAction(conversationId: string, formData: FormData): Promise<void> {
  const ctx = await userContext();
  if (!ctx || !UUID.test(conversationId)) return;
  const { data: rows } = await ctx.supabase.rpc("my_conversations", {
    p_archived: null as unknown as boolean,
    p_conversation_id: conversationId,
  });
  const other = rows?.[0]?.counterpart_user_id;
  if (!other) return;
  const action = String(formData.get("action") ?? "");
  const { error } =
    action === "unblock"
      ? await ctx.supabase.from("user_blocks").delete().eq("blocker_user_id", ctx.userId).eq("blocked_user_id", other)
      : await ctx.supabase.from("user_blocks").upsert({ blocker_user_id: ctx.userId, blocked_user_id: other }, { ignoreDuplicates: true });
  if (error) log.warn("messaging.block_failed", { action, code: error.code });
  refresh();
}

/** Report a message, person or piece of content to Greco's moderators. */
export async function reportAction(targetType: ReportTarget, targetId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await userContext();
  if (!ctx || !UUID.test(targetId) || !(REPORT_TARGETS as readonly string[]).includes(targetType)) return failed("notAllowed");
  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, ["details"]) });
  const { error } = await ctx.supabase.rpc("reports_create", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details ?? undefined,
  });
  if (error) return failed(dbErrorKey(error), { values: echo(formData, ["details"]) });
  return succeeded("reported");
}
