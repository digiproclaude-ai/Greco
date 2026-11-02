import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/server/db/database.types";

type Client = SupabaseClient<Database>;

export async function listOwnListings(supabase: Client, providerId: string) {
  const { data } = await supabase
    .from("service_listings")
    .select("id, slug, title, status, pricing_model, currency, updated_at")
    .eq("provider_id", providerId)
    .order("updated_at", { ascending: false });
  return data ?? [];
}

/** Everything the listing editor needs, read as the owner (RLS applies). */
export async function getListingEditor(supabase: Client, providerId: string, listingId: string) {
  const { data: listing } = await supabase
    .from("service_listings")
    .select(
      `*,
       service_listing_categories (category_id),
       service_listing_terms (term_id),
       service_packages (id, tier, name, description, price_minor, delivery_days, revisions_included, is_active),
       service_deliverables (id, title, package_id, sort_order),
       service_addons (id, title, description, price_minor, extra_delivery_days, sort_order),
       service_requirements (id, prompt, input_type, options, is_required, sort_order),
       service_faqs (id, question, answer, sort_order),
       service_media (id, alt_text, sort_order, file_objects (path))`,
    )
    .eq("id", listingId)
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!listing) return null;

  const [checklist, decision, pendingEdit] = await Promise.all([
    supabase.rpc("listing_checklist", { p_listing_id: listingId }),
    supabase
      .from("moderation_actions")
      .select("action, reason, created_at")
      .eq("target_type", "listing")
      .eq("target_id", listingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("review_requests")
      .select("id, kind, submitted_at")
      .eq("target_type", "listing")
      .eq("target_id", listingId)
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  const bySort = <T extends { sort_order: number }>(rows: T[]) => [...rows].sort((a, b) => a.sort_order - b.sort_order);
  const secondary = listing.service_listing_categories.find((row) => row.category_id !== listing.primary_category_id);

  return {
    listing,
    secondaryCategoryId: secondary?.category_id ?? null,
    termIds: listing.service_listing_terms.map((row) => row.term_id),
    packages: [...listing.service_packages].sort((a, b) => a.tier - b.tier),
    deliverables: bySort(listing.service_deliverables),
    addons: bySort(listing.service_addons),
    requirements: bySort(listing.service_requirements),
    faqs: bySort(listing.service_faqs),
    media: bySort(listing.service_media).map((row) => ({ id: row.id, alt: row.alt_text, path: row.file_objects?.path ?? null })),
    missing: checklist.data ?? [],
    lastDecision: decision.data ?? null,
    pendingReview: pendingEdit.data ?? null,
  };
}

export type ListingEditorData = NonNullable<Awaited<ReturnType<typeof getListingEditor>>>;
