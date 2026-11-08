"use server";

import { getLocale } from "next-intl/server";
import { refresh } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { log } from "@/server/log";
import { failed, succeeded, type ActionState } from "@/server/modules/shared/action-state";
import { userContext } from "@/server/modules/shared/context";
import { dbErrorKey } from "@/server/modules/shared/db-errors";

import { notificationHref } from "./present";

const UUID = /^[0-9a-f-]{36}$/i;

/** Mark one notification read and go where it leads. */
export async function openNotificationAction(formData: FormData): Promise<void> {
  const ctx = await userContext();
  const id = String(formData.get("id") ?? "");
  if (!ctx || !UUID.test(id)) return;
  const { data: notification } = await ctx.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select("type_key, entity_type, entity_id, params, count")
    .maybeSingle();
  if (!notification) return;
  return redirect({ href: notificationHref(notification), locale: await getLocale() });
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const ctx = await userContext();
  if (!ctx) return;
  const { error } = await ctx.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", ctx.userId)
    .is("read_at", null);
  if (error) log.warn("notifications.mark_all_failed", { code: error.code });
  refresh();
}

/** Save the user's choices for every configurable type and channel shown in the form. */
export async function savePreferencesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await userContext();
  if (!ctx) return failed("notAllowed");
  const { data: types } = await ctx.supabase.from("notification_types").select("key").eq("user_configurable", true);
  const shown = new Set(formData.getAll("shown").map(String));
  const rows = (types ?? []).flatMap((type) =>
    (["in_app", "email"] as const)
      .filter((channel) => shown.has(`${type.key}:${channel}`))
      .map((channel) => ({
        user_id: ctx.userId,
        type_key: type.key,
        channel,
        enabled: formData.get(`${type.key}:${channel}`) === "on",
        updated_at: new Date().toISOString(),
      })),
  );
  if (rows.length === 0) return succeeded();
  const { error } = await ctx.supabase.from("notification_preferences").upsert(rows, { onConflict: "user_id,type_key,channel" });
  if (error) return failed(dbErrorKey(error));
  refresh();
  return succeeded();
}
