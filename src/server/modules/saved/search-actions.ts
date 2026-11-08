"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { log } from "@/server/log";
import { echo, failed, succeeded, type ActionState } from "@/server/modules/shared/action-state";
import { userContext } from "@/server/modules/shared/context";
import { dbErrorKey } from "@/server/modules/shared/db-errors";
import { checkbox, requiredText, toFieldErrors } from "@/server/modules/shared/validation";

/** Search parameters a saved search may keep, per kind (the rest of the URL is dropped). */
const KEYS = {
  services: ["q", "category", "skill", "currency", "min", "max", "delivery", "type", "country", "language", "model", "sort"],
  experts: ["q", "category", "skill", "type", "country", "language", "sort"],
} as const;

const nameSchema = z.object({ name: requiredText(1, 80), alerts: checkbox() });

export async function saveSearchAction(
  kind: "services" | "experts",
  query: Record<string, string>,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await userContext();
  if (!ctx || !(kind in KEYS)) return failed("notAllowed");
  const parsed = nameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, ["name"]) });
  const allowed = new Set<string>(KEYS[kind]);
  const clean = Object.fromEntries(
    Object.entries(query)
      .filter(([key, value]) => allowed.has(key) && typeof value === "string" && value.length > 0 && value.length <= 120)
      .slice(0, 12),
  );
  const { error } = await ctx.supabase
    .from("saved_searches")
    .insert({ user_id: ctx.userId, kind, name: parsed.data.name, query: clean, alerts_enabled: parsed.data.alerts });
  if (error) return failed(dbErrorKey(error), { values: echo(formData, ["name"]) });
  refresh();
  return succeeded("searchSaved");
}

/** Turn alerts on or off, or delete a saved search (own rows only, RLS checks again). */
export async function updateSavedSearchAction(formData: FormData): Promise<void> {
  const ctx = await userContext();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!ctx || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const table = ctx.supabase.from("saved_searches");
  const { error } =
    action === "delete"
      ? await table.delete().eq("id", id).eq("user_id", ctx.userId)
      : action === "alerts_on" || action === "alerts_off"
        ? await table.update({ alerts_enabled: action === "alerts_on" }).eq("id", id).eq("user_id", ctx.userId)
        : { error: null };
  if (error) log.warn("saved_search.update_failed", { action, code: error.code });
  refresh();
}
