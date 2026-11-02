import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/server/db/database.types";

type Client = SupabaseClient<Database>;

/** Whether the signed-in user saved a target. Returns false when signed out. */
export async function isSaved(supabase: Client, userId: string, kind: "provider" | "listing" | "category", id: string) {
  const query =
    kind === "provider"
      ? supabase.from("saved_providers").select("provider_id").eq("user_id", userId).eq("provider_id", id)
      : kind === "listing"
        ? supabase.from("saved_services").select("listing_id").eq("user_id", userId).eq("listing_id", id)
        : supabase.from("saved_categories").select("category_id").eq("user_id", userId).eq("category_id", id);
  const { data } = await query.maybeSingle();
  return Boolean(data);
}

export async function listSaved(supabase: Client, userId: string) {
  const [providers, services, categories] = await Promise.all([
    supabase
      .from("saved_providers")
      .select("created_at, providers (id, handle, display_name, headline, status)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_services")
      .select("created_at, service_listings (id, slug, title, summary, status, providers (handle, display_name))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("saved_categories").select("category_id, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);
  return {
    providers: (providers.data ?? []).flatMap((row) => (row.providers ? [row.providers] : [])),
    services: (services.data ?? []).flatMap((row) => (row.service_listings ? [row.service_listings] : [])),
    categoryIds: (categories.data ?? []).map((row) => row.category_id),
  };
}
