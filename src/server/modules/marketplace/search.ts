import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { LANGUAGE_CODES } from "@/lib/languages";
import { CURRENCIES, parseMoneyToMinor } from "@/lib/money";
import { createSupabaseAnonClient } from "@/server/db/supabase-server";
import type { Database } from "@/server/db/database.types";
import { CATALOG_TAG, softFail } from "@/server/modules/taxonomy/service";

export const PAGE_SIZE = 24;
export const LISTING_SORTS = ["relevance", "newest", "price_asc", "price_desc", "delivery"] as const;
export const PROVIDER_SORTS = ["relevance", "newest"] as const;
export const DELIVERY_OPTIONS = [1, 3, 7, 14, 30] as const;

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === "" ? undefined : v), schema.optional()).catch(undefined);

const listingParams = z.object({
  q: optional(z.string().trim().max(120)),
  category: optional(z.uuid()),
  skill: optional(z.uuid()),
  currency: optional(z.enum(CURRENCIES)),
  min: optional(z.string().max(12)),
  max: optional(z.string().max(12)),
  delivery: optional(z.coerce.number().int().min(1).max(365)),
  type: optional(z.enum(["individual", "agency"])),
  country: optional(z.string().regex(/^[A-Z]{2}$/)),
  language: optional(z.enum(LANGUAGE_CODES)),
  model: optional(z.enum(["fixed", "packages", "hourly", "quote"])),
  sort: optional(z.enum(LISTING_SORTS)),
  page: optional(z.coerce.number().int().min(1).max(400)),
});

export type ListingFilters = {
  q: string | null;
  category: string | null;
  skill: string | null;
  currency: "USD" | "EUR";
  minMinor: number | null;
  maxMinor: number | null;
  min: string | null;
  max: string | null;
  delivery: number | null;
  type: "individual" | "agency" | null;
  country: string | null;
  language: string | null;
  model: Database["public"]["Enums"]["pricing_model"] | null;
  sort: (typeof LISTING_SORTS)[number];
  page: number;
};

/** Validate search parameters from the URL. Anything invalid is ignored rather than rejected. */
export function parseListingFilters(raw: RawParams): ListingFilters {
  const flat = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, first(value)]));
  const p = listingParams.parse(flat);
  const currency = p.currency ?? "USD";
  const minMinor = p.min ? parseMoneyToMinor(p.min, currency) : null;
  const maxMinor = p.max ? parseMoneyToMinor(p.max, currency) : null;
  return {
    q: p.q || null,
    category: p.category ?? null,
    skill: p.skill ?? null,
    currency,
    minMinor,
    maxMinor,
    min: minMinor === null ? null : (p.min ?? null),
    max: maxMinor === null ? null : (p.max ?? null),
    delivery: p.delivery ?? null,
    type: p.type ?? null,
    country: p.country ?? null,
    language: p.language ?? null,
    model: p.model ?? null,
    sort: p.sort ?? (p.q ? "relevance" : "newest"),
    page: p.page ?? 1,
  };
}

export type ListingCardData = Database["public"]["Functions"]["search_listings"]["Returns"][number];

export async function searchListings(filters: ListingFilters & { providerId?: string | null; limit?: number }) {
  "use cache";
  cacheTag(CATALOG_TAG);
  const limit = filters.limit ?? PAGE_SIZE;
  const { data, error } = await createSupabaseAnonClient().rpc("search_listings", {
    p_query: filters.q ?? undefined,
    p_category_id: filters.category ?? undefined,
    p_term_ids: filters.skill ? [filters.skill] : undefined,
    p_currency: filters.currency,
    p_min_price_minor: filters.minMinor ?? undefined,
    p_max_price_minor: filters.maxMinor ?? undefined,
    p_max_delivery_days: filters.delivery ?? undefined,
    p_provider_type: filters.type ?? undefined,
    p_country: filters.country ?? undefined,
    p_language: filters.language ?? undefined,
    p_pricing_model: filters.model ?? undefined,
    p_provider_id: filters.providerId ?? undefined,
    p_sort: filters.sort,
    p_limit: limit,
    p_offset: (filters.page - 1) * limit,
  });
  if (error) return softFail("search_listings", error, { items: [] as ListingCardData[], total: 0 });
  cacheLife("minutes");
  return { items: data, total: Number(data[0]?.total_count ?? 0) };
}

const providerParams = z.object({
  q: optional(z.string().trim().max(120)),
  category: optional(z.uuid()),
  skill: optional(z.uuid()),
  type: optional(z.enum(["individual", "agency"])),
  country: optional(z.string().regex(/^[A-Z]{2}$/)),
  language: optional(z.enum(LANGUAGE_CODES)),
  sort: optional(z.enum(PROVIDER_SORTS)),
  page: optional(z.coerce.number().int().min(1).max(400)),
});

export type ProviderFilters = {
  q: string | null;
  category: string | null;
  skill: string | null;
  type: "individual" | "agency" | null;
  country: string | null;
  language: string | null;
  sort: (typeof PROVIDER_SORTS)[number];
  page: number;
};

export function parseProviderFilters(raw: RawParams): ProviderFilters {
  const flat = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, first(value)]));
  const p = providerParams.parse(flat);
  return {
    q: p.q || null,
    category: p.category ?? null,
    skill: p.skill ?? null,
    type: p.type ?? null,
    country: p.country ?? null,
    language: p.language ?? null,
    sort: p.sort ?? (p.q ? "relevance" : "newest"),
    page: p.page ?? 1,
  };
}

export type ProviderCardData = Database["public"]["Functions"]["search_providers"]["Returns"][number];

export async function searchProviders(filters: ProviderFilters) {
  "use cache";
  cacheTag(CATALOG_TAG);
  const { data, error } = await createSupabaseAnonClient().rpc("search_providers", {
    p_query: filters.q ?? undefined,
    p_category_id: filters.category ?? undefined,
    p_term_ids: filters.skill ? [filters.skill] : undefined,
    p_provider_type: filters.type ?? undefined,
    p_country: filters.country ?? undefined,
    p_language: filters.language ?? undefined,
    p_sort: filters.sort,
    p_limit: PAGE_SIZE,
    p_offset: (filters.page - 1) * PAGE_SIZE,
  });
  if (error) return softFail("search_providers", error, { items: [] as ProviderCardData[], total: 0 });
  cacheLife("minutes");
  return { items: data, total: Number(data[0]?.total_count ?? 0) };
}

/** Build a query string from filters, dropping empty values (for links and pagination). */
export function toQuery(values: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== "" && !(key === "page" && value === 1)) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function emptyListingFilters(overrides: Partial<ListingFilters> = {}): ListingFilters {
  return {
    q: null,
    category: null,
    skill: null,
    currency: "USD",
    minMinor: null,
    maxMinor: null,
    min: null,
    max: null,
    delivery: null,
    type: null,
    country: null,
    language: null,
    model: null,
    sort: "newest",
    page: 1,
    ...overrides,
  };
}

export function listingFilterQuery(filters: ListingFilters, page: number, omitCategory = false): string {
  return toQuery({
    q: filters.q,
    category: omitCategory ? null : filters.category,
    skill: filters.skill,
    currency: filters.min || filters.max ? filters.currency : null,
    min: filters.min,
    max: filters.max,
    delivery: filters.delivery,
    type: filters.type,
    country: filters.country,
    language: filters.language,
    model: filters.model,
    sort: filters.sort === (filters.q ? "relevance" : "newest") ? null : filters.sort,
    page,
  });
}
