"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { log } from "@/server/log";
import { userContext } from "@/server/modules/shared/context";

const targetSchema = z.object({
  kind: z.enum(["provider", "listing", "category"]),
  id: z.uuid(),
  saved: z.enum(["0", "1"]),
});

/** Save or unsave an expert, service or category for the signed-in user (Class A, RLS-owned). */
export async function toggleSavedAction(formData: FormData): Promise<void> {
  const ctx = await userContext();
  const parsed = targetSchema.safeParse(Object.fromEntries(formData));
  if (!ctx || !parsed.success) return;
  const { kind, id, saved } = parsed.data;
  const remove = saved === "1";

  let error: { code?: string } | null = null;
  if (kind === "provider") {
    ({ error } = remove
      ? await ctx.supabase.from("saved_providers").delete().eq("user_id", ctx.userId).eq("provider_id", id)
      : await ctx.supabase.from("saved_providers").upsert({ user_id: ctx.userId, provider_id: id }, { ignoreDuplicates: true }));
  } else if (kind === "listing") {
    ({ error } = remove
      ? await ctx.supabase.from("saved_services").delete().eq("user_id", ctx.userId).eq("listing_id", id)
      : await ctx.supabase.from("saved_services").upsert({ user_id: ctx.userId, listing_id: id }, { ignoreDuplicates: true }));
  } else {
    ({ error } = remove
      ? await ctx.supabase.from("saved_categories").delete().eq("user_id", ctx.userId).eq("category_id", id)
      : await ctx.supabase.from("saved_categories").upsert({ user_id: ctx.userId, category_id: id }, { ignoreDuplicates: true }));
  }
  if (error) log.warn("saved.toggle_failed", { kind, code: error.code });
  refresh();
}
