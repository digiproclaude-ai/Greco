import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/server/db/database.types";

type Client = SupabaseClient<Database>;

export async function listNotifications(supabase: Client, userId: string, limit = 50) {
  const { data } = await supabase
    .from("notifications")
    .select("id, type_key, entity_type, entity_id, params, count, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export type NotificationChannel = "in_app" | "email";

export type PreferenceRow = {
  key: string;
  category: string;
  configurable: boolean;
  /** Channels the type supports at all (its defaults), and whether each is on for this user. */
  channels: { channel: NotificationChannel; enabled: boolean }[];
};

/** Every notification type with the user's effective setting per channel. */
export async function getPreferences(supabase: Client, userId: string): Promise<PreferenceRow[]> {
  const [{ data: types }, { data: prefs }] = await Promise.all([
    supabase.from("notification_types").select("key, category, default_channels, user_configurable").order("key"),
    supabase.from("notification_preferences").select("type_key, channel, enabled").eq("user_id", userId),
  ]);
  const chosen = new Map((prefs ?? []).map((p) => [`${p.type_key}:${p.channel}`, p.enabled]));
  return (types ?? []).map((type) => ({
    key: type.key,
    category: type.category,
    configurable: type.user_configurable,
    channels: (["in_app", "email"] as const)
      .filter((channel) => type.default_channels.includes(channel) || chosen.has(`${type.key}:${channel}`) || channel === "email")
      .map((channel) => ({
        channel,
        enabled: chosen.get(`${type.key}:${channel}`) ?? type.default_channels.includes(channel),
      })),
  }));
}
