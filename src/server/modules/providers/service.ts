import "server-only";

import type { Database } from "@/server/db/database.types";
import type { Tables } from "@/server/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export type ProviderEditorData = {
  provider: Tables<"providers">;
  avatarPath: string | null;
  languages: Pick<Tables<"provider_languages">, "language_code" | "proficiency">[];
  links: Pick<Tables<"provider_links">, "id" | "kind" | "url" | "verified_at">[];
  termIds: string[];
  agency: Tables<"provider_agency_details"> | null;
  /** Missing checklist items (empty when ready to submit). */
  missing: string[];
  lastDecision: Pick<Tables<"moderation_actions">, "action" | "reason" | "created_at"> | null;
};

/** Everything the profile editor needs, read as the owner (RLS applies). */
export async function getProviderEditor(supabase: Client, providerId: string): Promise<ProviderEditorData | null> {
  const [provider, languages, links, terms, agency, checklist, decision] = await Promise.all([
    supabase.from("providers").select("*").eq("id", providerId).maybeSingle(),
    supabase.from("provider_languages").select("language_code, proficiency").eq("provider_id", providerId),
    supabase.from("provider_links").select("id, kind, url, verified_at").eq("provider_id", providerId).order("created_at"),
    supabase.from("provider_terms").select("term_id").eq("provider_id", providerId),
    supabase.from("provider_agency_details").select("*").eq("provider_id", providerId).maybeSingle(),
    supabase.rpc("provider_profile_checklist", { p_provider_id: providerId }),
    supabase
      .from("moderation_actions")
      .select("action, reason, created_at")
      .eq("target_type", "provider")
      .eq("target_id", providerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!provider.data) return null;

  let avatarPath: string | null = null;
  if (provider.data.avatar_file_id) {
    const { data } = await supabase.from("file_objects").select("path").eq("id", provider.data.avatar_file_id).maybeSingle();
    avatarPath = data?.path ?? null;
  }

  return {
    provider: provider.data,
    avatarPath,
    languages: languages.data ?? [],
    links: links.data ?? [],
    termIds: (terms.data ?? []).map((row) => row.term_id),
    agency: agency.data ?? null,
    missing: checklist.data ?? [],
    lastDecision: decision.data ?? null,
  };
}

/** Counts for the expert overview. */
export async function getExpertOverview(supabase: Client, providerId: string) {
  const [checklist, listings, portfolio] = await Promise.all([
    supabase.rpc("provider_profile_checklist", { p_provider_id: providerId }),
    supabase.from("service_listings").select("status").eq("provider_id", providerId),
    supabase.from("portfolio_items").select("id", { count: "exact", head: true }).eq("provider_id", providerId),
  ]);
  const byStatus: Record<string, number> = {};
  for (const row of listings.data ?? []) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  return {
    missing: checklist.data ?? [],
    listingCount: listings.data?.length ?? 0,
    listingsByStatus: byStatus,
    portfolioCount: portfolio.count ?? 0,
  };
}
