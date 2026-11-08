import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/server/db/database.types";
import { loadListingPage, loadProviderPage } from "@/server/modules/marketplace/public";
import { CATEGORY_SELECT, pickTranslation, toCategories, type TermKind } from "@/server/modules/taxonomy/service";

type Client = SupabaseClient<Database>;

/** Staff reads. RLS lets staff (with MFA) see everything they need; pages call requireStaff first. */
export async function getAdminCounts(supabase: Client) {
  const [requests, terms, reports] = await Promise.all([
    supabase.from("review_requests").select("target_type, kind").eq("status", "pending"),
    supabase.from("taxonomy_terms").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const rows = requests.data ?? [];
  return {
    profiles: rows.filter((r) => r.target_type === "provider").length,
    listings: rows.filter((r) => r.target_type === "listing" && r.kind === "initial").length,
    edits: rows.filter((r) => r.target_type === "listing" && r.kind === "edit").length,
    terms: terms.count ?? 0,
    reports: reports.count ?? 0,
  };
}

export async function listPendingReviews(supabase: Client) {
  const { data } = await supabase
    .from("review_requests")
    .select("id, target_type, target_id, kind, flags, submitted_at, providers (display_name, handle)")
    .eq("status", "pending")
    .order("submitted_at")
    .limit(200);
  const rows = data ?? [];
  const listingIds = rows.filter((r) => r.target_type === "listing").map((r) => r.target_id);
  const { data: listings } = listingIds.length
    ? await supabase.from("service_listings").select("id, title").in("id", listingIds)
    : { data: [] as { id: string; title: string }[] };
  const titles = new Map((listings ?? []).map((l) => [l.id, l.title]));
  return rows.map((row) => ({
    id: row.id,
    targetType: row.target_type,
    kind: row.kind,
    flags: row.flags,
    submittedAt: row.submitted_at,
    providerName: row.providers?.display_name ?? "",
    title: row.target_type === "listing" ? (titles.get(row.target_id) ?? "") : (row.providers?.display_name ?? ""),
  }));
}

export async function listRecentDecisions(supabase: Client) {
  const { data } = await supabase
    .from("moderation_actions")
    .select("id, target_type, target_id, action, reason, created_at, providers (display_name)")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getReviewDetail(supabase: Client, requestId: string, locale: string) {
  const { data: request } = await supabase
    .from("review_requests")
    .select("id, target_type, target_id, provider_id, kind, status, flags, submitted_at, decided_at, reason")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return null;

  const [{ data: provider }, { data: history }] = await Promise.all([
    supabase.from("providers").select("id, handle, display_name, status").eq("id", request.provider_id).maybeSingle(),
    supabase
      .from("moderation_actions")
      .select("id, action, reason, created_at")
      .eq("target_type", request.target_type)
      .eq("target_id", request.target_id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (!provider) return null;

  if (request.target_type === "provider") {
    const { page } = await loadProviderPage(supabase, provider.handle, locale);
    return { request, provider, history: history ?? [], profile: page, listing: null };
  }
  const { data: listingRow } = await supabase.from("service_listings").select("slug").eq("id", request.target_id).maybeSingle();
  const { page } = listingRow ? await loadListingPage(supabase, provider.handle, listingRow.slug, locale) : { page: null };
  return { request, provider, history: history ?? [], profile: null, listing: page };
}

export async function searchCatalog(supabase: Client, query: string | null, status: string | null) {
  const like = query ? `%${query.replace(/[%_]/g, "")}%` : null;
  let providers = supabase.from("providers").select("id, handle, display_name, status, updated_at").order("updated_at", { ascending: false }).limit(25);
  let listings = supabase
    .from("service_listings")
    .select("id, slug, title, status, updated_at, providers (handle, display_name)")
    .order("updated_at", { ascending: false })
    .limit(25);
  if (like) {
    providers = providers.ilike("display_name", like);
    listings = listings.ilike("title", like);
  }
  if (status === "suspended") {
    providers = providers.eq("status", "suspended");
    listings = listings.eq("status", "suspended");
  } else if (status === "live") {
    providers = providers.eq("status", "active");
    listings = listings.eq("status", "published");
  }
  const [p, l] = await Promise.all([providers, listings]);
  return { providers: p.data ?? [], listings: l.data ?? [] };
}

/** Every category including inactive ones (staff view). */
export async function listAllCategories(supabase: Client, locale: string) {
  const { data } = await supabase.from("categories").select(CATEGORY_SELECT);
  return toCategories((data ?? []) as Parameters<typeof toCategories>[0], locale);
}

export type AdminTerm = {
  id: string;
  kind: TermKind;
  slug: string;
  status: string;
  name: string;
  description: string | null;
  aliases: string[];
  mergedIntoId: string | null;
};

export async function listTerms(
  supabase: Client,
  locale: string,
  filters: { kind?: TermKind | null; status?: string | null },
): Promise<AdminTerm[]> {
  let query = supabase
    .from("taxonomy_terms")
    .select("id, kind, slug, status, merged_into_id, taxonomy_term_translations (locale, name, description), taxonomy_term_aliases (alias)")
    .order("slug")
    .limit(500);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.status) query = query.eq("status", filters.status as Database["public"]["Enums"]["term_status"]);
  const { data } = await query;
  return (data ?? []).map((row) => {
    const t = pickTranslation(row.taxonomy_term_translations, locale);
    return {
      id: row.id,
      kind: row.kind,
      slug: row.slug,
      status: row.status,
      name: t?.name ?? row.slug,
      description: t?.description ?? null,
      aliases: row.taxonomy_term_aliases.map((a) => a.alias),
      mergedIntoId: row.merged_into_id,
    };
  });
}
