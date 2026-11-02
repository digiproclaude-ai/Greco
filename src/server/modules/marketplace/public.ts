import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";

import type { Database } from "@/server/db/database.types";
import { createSupabaseAnonClient } from "@/server/db/supabase-server";
import { CATALOG_TAG, pickTranslation, softFail, type TermKind } from "@/server/modules/taxonomy/service";

type Client = SupabaseClient<Database>;

/** Columns anonymous visitors may read on providers (see the security migration's column grants). */
const PROVIDER_PUBLIC_COLUMNS =
  "id, provider_type, handle, display_name, headline, bio, country_code, city, timezone, experience_level, years_experience, indicative_hourly_rate_minor, rate_currency, availability, availability_note, website_url, status, published_at";

type TermJoin = {
  term_id: string;
  taxonomy_terms: { kind: TermKind; slug: string; status: string; taxonomy_term_translations: { locale: string; name: string }[] } | null;
};

function termsFrom(rows: TermJoin[] | null | undefined, locale: string) {
  return (rows ?? [])
    .flatMap((row) =>
      row.taxonomy_terms && row.taxonomy_terms.status === "active"
        ? [{ id: row.term_id, kind: row.taxonomy_terms.kind, slug: row.taxonomy_terms.slug, name: pickTranslation(row.taxonomy_terms.taxonomy_term_translations, locale)?.name ?? row.taxonomy_terms.slug }]
        : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

const TERM_SELECT = "term_id, taxonomy_terms (kind, slug, status, taxonomy_term_translations (locale, name))";

export async function loadProviderPage(supabase: Client, handle: string, locale: string) {
  const { data: provider, error } = await supabase
    .from("providers")
    .select(
      `${PROVIDER_PUBLIC_COLUMNS},
       avatar:file_objects!providers_avatar_file_id_fkey (path),
       provider_languages (language_code, proficiency),
       provider_links (kind, url),
       provider_terms (${TERM_SELECT}),
       provider_agency_details (founded_year, team_size_range, office_locations)`,
    )
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  if (error) return { error, page: null };
  if (!provider) return { error: null, page: null };

  const { data: portfolio } = await supabase
    .from("portfolio_items")
    .select(
      `id, title, summary, problem, solution, results, role, client_display_name, project_date, external_url, provenance, status, sort_order,
       portfolio_item_media (id, caption, sort_order, file_objects (path)),
       portfolio_item_terms (${TERM_SELECT})`,
    )
    .eq("provider_id", provider.id)
    .eq("status", "published")
    .order("sort_order")
    .order("created_at", { ascending: false })
    .limit(30);

  const agency = Array.isArray(provider.provider_agency_details)
    ? provider.provider_agency_details[0]
    : provider.provider_agency_details;

  return {
    error: null,
    page: {
      id: provider.id,
      handle: provider.handle,
      displayName: provider.display_name,
      headline: provider.headline,
      bio: provider.bio,
      providerType: provider.provider_type,
      countryCode: provider.country_code,
      city: provider.city,
      timezone: provider.timezone,
      experienceLevel: provider.experience_level,
      yearsExperience: provider.years_experience,
      rateMinor: provider.indicative_hourly_rate_minor,
      rateCurrency: provider.rate_currency,
      availability: provider.availability,
      availabilityNote: provider.availability_note,
      websiteUrl: provider.website_url,
      status: provider.status,
      publishedAt: provider.published_at,
      avatarPath: provider.avatar?.path ?? null,
      languages: provider.provider_languages,
      links: provider.provider_links,
      terms: termsFrom(provider.provider_terms as TermJoin[], locale),
      agency: agency
        ? { foundedYear: agency.founded_year, teamSize: agency.team_size_range, offices: agency.office_locations ?? [] }
        : null,
      portfolio: (portfolio ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        problem: item.problem,
        solution: item.solution,
        results: item.results,
        role: item.role,
        clientName: item.client_display_name,
        projectDate: item.project_date,
        externalUrl: item.external_url,
        provenance: item.provenance,
        media: [...item.portfolio_item_media]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((media) => ({ id: media.id, caption: media.caption, path: media.file_objects?.path ?? null })),
        terms: termsFrom(item.portfolio_item_terms as TermJoin[], locale),
      })),
    },
  };
}

export type ProviderPage = NonNullable<Awaited<ReturnType<typeof loadProviderPage>>["page"]>;

/** Public expert profile (active experts only), cached and refreshed when experts edit. */
export async function getPublicProviderPage(handle: string, locale: string): Promise<ProviderPage | null> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const { error, page } = await loadProviderPage(createSupabaseAnonClient(), handle, locale);
  if (error) return softFail("provider_page", error, null);
  cacheLife("minutes");
  return page;
}

export async function loadListingPage(supabase: Client, handle: string, slug: string, locale: string) {
  const { data: listing, error } = await supabase
    .from("service_listings")
    .select(
      `id, slug, status, title, summary, description, primary_category_id, pricing_model, currency, fixed_price_minor,
       hourly_rate_minor, min_hours, quote_from_minor, base_delivery_days, payment_model, deposit_bps, balance_trigger,
       revisions_included, revision_policy, requirements_intro, published_at, updated_at,
       providers!inner (id, handle, display_name, headline, provider_type, country_code, experience_level, availability, status,
         avatar:file_objects!providers_avatar_file_id_fkey (path)),
       service_listing_categories (category_id),
       service_listing_terms (${TERM_SELECT}),
       service_packages (id, tier, name, description, price_minor, delivery_days, revisions_included, is_active),
       service_deliverables (id, title, package_id, sort_order),
       service_addons (id, title, description, price_minor, extra_delivery_days, is_active, sort_order),
       service_requirements (id, prompt, input_type, is_required, sort_order),
       service_faqs (id, question, answer, sort_order),
       service_media (id, alt_text, sort_order, file_objects (path))`,
    )
    .eq("slug", slug.toLowerCase())
    .eq("providers.handle", handle.toLowerCase())
    .maybeSingle();
  if (error) return { error, page: null };
  if (!listing) return { error: null, page: null };

  const bySort = <T extends { sort_order: number }>(rows: T[]) => [...rows].sort((a, b) => a.sort_order - b.sort_order);
  const provider = listing.providers;

  return {
    error: null,
    page: {
      id: listing.id,
      slug: listing.slug,
      status: listing.status,
      title: listing.title,
      summary: listing.summary,
      description: listing.description,
      primaryCategoryId: listing.primary_category_id,
      categoryIds: listing.service_listing_categories.map((row) => row.category_id),
      pricingModel: listing.pricing_model,
      currency: listing.currency,
      fixedPriceMinor: listing.fixed_price_minor,
      hourlyRateMinor: listing.hourly_rate_minor,
      minHours: listing.min_hours,
      quoteFromMinor: listing.quote_from_minor,
      baseDeliveryDays: listing.base_delivery_days,
      paymentModel: listing.payment_model,
      depositBps: listing.deposit_bps,
      balanceTrigger: listing.balance_trigger,
      revisionsIncluded: listing.revisions_included,
      revisionPolicy: listing.revision_policy,
      publishedAt: listing.published_at,
      updatedAt: listing.updated_at,
      provider: {
        id: provider.id,
        handle: provider.handle,
        displayName: provider.display_name,
        headline: provider.headline,
        providerType: provider.provider_type,
        countryCode: provider.country_code,
        experienceLevel: provider.experience_level,
        availability: provider.availability,
        status: provider.status,
        avatarPath: provider.avatar?.path ?? null,
      },
      terms: termsFrom(listing.service_listing_terms as TermJoin[], locale),
      packages: listing.service_packages.filter((pkg) => pkg.is_active).sort((a, b) => a.tier - b.tier),
      deliverables: bySort(listing.service_deliverables),
      addons: bySort(listing.service_addons).filter((addon) => addon.is_active),
      requirements: bySort(listing.service_requirements),
      faqs: bySort(listing.service_faqs),
      media: bySort(listing.service_media).map((row) => ({ id: row.id, alt: row.alt_text, path: row.file_objects?.path ?? null })),
    },
  };
}

export type ListingPage = NonNullable<Awaited<ReturnType<typeof loadListingPage>>["page"]>;

export async function getPublicListingPage(handle: string, slug: string, locale: string): Promise<ListingPage | null> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const { error, page } = await loadListingPage(createSupabaseAnonClient(), handle, slug, locale);
  if (error) return softFail("listing_page", error, null);
  cacheLife("minutes");
  return page;
}

/** Lowest price a client would see, used on the service page. */
export function listingPriceFrom(page: ListingPage): number | null {
  switch (page.pricingModel) {
    case "fixed":
      return page.fixedPriceMinor;
    case "hourly":
      return page.hourlyRateMinor && page.minHours ? page.hourlyRateMinor * page.minHours : null;
    case "packages":
      return page.packages.length > 0 ? Math.min(...page.packages.map((pkg) => pkg.price_minor)) : null;
    default:
      return page.quoteFromMinor;
  }
}
