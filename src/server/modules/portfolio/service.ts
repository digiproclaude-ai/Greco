import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/server/db/database.types";

type Client = SupabaseClient<Database>;

export async function listOwnPortfolio(supabase: Client, providerId: string) {
  const { data } = await supabase
    .from("portfolio_items")
    .select("id, title, summary, status, provenance, updated_at, sort_order")
    .eq("provider_id", providerId)
    .order("sort_order")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getPortfolioEditor(supabase: Client, providerId: string, itemId: string) {
  const { data: item } = await supabase
    .from("portfolio_items")
    .select("*, portfolio_item_terms (term_id), portfolio_item_media (id, caption, sort_order, file_objects (path))")
    .eq("id", itemId)
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!item) return null;
  return {
    item,
    termIds: item.portfolio_item_terms.map((row) => row.term_id),
    media: [...item.portfolio_item_media]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => ({ id: row.id, caption: row.caption, path: row.file_objects?.path ?? null })),
  };
}
