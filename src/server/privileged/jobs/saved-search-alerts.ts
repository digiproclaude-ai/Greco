import "server-only";

import { log } from "@/server/log";
import { parseListingFilters, parseProviderFilters } from "@/server/modules/marketplace/search";

import { createSupabaseAdminClient } from "../supabase-admin";

type Raw = Record<string, string | string[] | undefined>;

function asParams(query: unknown): Raw {
  if (!query || typeof query !== "object") return {};
  return Object.fromEntries(Object.entries(query as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Raw;
}

/**
 * Daily saved-search alerts: count what was published since the last alert and leave one in-app
 * notification per search with new results.
 */
export async function runSavedSearchAlerts() {
  const supabase = createSupabaseAdminClient();
  const { data: searches, error } = await supabase.rpc("saved_search_alert_candidates", { p_limit: 100 });
  if (error) throw new Error(`saved_search_alert_candidates failed: ${error.message}`);

  let alerted = 0;
  for (const search of searches ?? []) {
    try {
      const params = asParams(search.query);
      let matches = 0;
      if (search.kind === "services") {
        const f = parseListingFilters(params);
        const { data } = await supabase.rpc("search_listings", {
          p_query: f.q ?? undefined,
          p_category_id: f.category ?? undefined,
          p_term_ids: f.skill ? [f.skill] : undefined,
          p_currency: f.currency,
          p_min_price_minor: f.minMinor ?? undefined,
          p_max_price_minor: f.maxMinor ?? undefined,
          p_max_delivery_days: f.delivery ?? undefined,
          p_provider_type: f.type ?? undefined,
          p_country: f.country ?? undefined,
          p_language: f.language ?? undefined,
          p_pricing_model: f.model ?? undefined,
          p_sort: "newest",
          p_limit: 50,
        });
        const ids = (data ?? []).map((row) => row.listing_id);
        if (ids.length > 0) {
          const { count } = await supabase
            .from("service_listings")
            .select("id", { count: "exact", head: true })
            .in("id", ids)
            .gt("published_at", search.since);
          matches = count ?? 0;
        }
      } else {
        const f = parseProviderFilters(params);
        const { data } = await supabase.rpc("search_providers", {
          p_query: f.q ?? undefined,
          p_category_id: f.category ?? undefined,
          p_term_ids: f.skill ? [f.skill] : undefined,
          p_provider_type: f.type ?? undefined,
          p_country: f.country ?? undefined,
          p_language: f.language ?? undefined,
          p_sort: "newest",
          p_limit: 50,
        });
        const ids = (data ?? []).map((row) => row.provider_id);
        if (ids.length > 0) {
          const { count } = await supabase
            .from("providers")
            .select("id", { count: "exact", head: true })
            .in("id", ids)
            .gt("published_at", search.since);
          matches = count ?? 0;
        }
      }
      await supabase.rpc("saved_search_record_alert", { p_id: search.id, p_matches: matches });
      if (matches > 0) alerted += 1;
    } catch (searchError) {
      log.warn("saved_search.alert_failed", { error: searchError instanceof Error ? searchError.message : String(searchError) });
    }
  }
  return { checked: searches?.length ?? 0, alerted };
}
