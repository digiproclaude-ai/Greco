import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { SaveSearch } from "@/components/marketplace/save-search";
import { CardGrid, ListingCard } from "@/components/marketplace/cards";
import { ListingFiltersForm } from "@/components/marketplace/filters";
import { Pagination } from "@/components/marketplace/pagination";
import { ResultsSkeleton } from "@/components/marketplace/results-skeleton";
import { SearchBox } from "@/components/marketplace/search-box";
import { Link } from "@/i18n/navigation";
import {
  listingFilterQuery,
  PAGE_SIZE,
  parseListingFilters,
  searchListings,
} from "@/server/modules/marketplace/search";
import { workTerms } from "@/server/modules/taxonomy/labels";
import { categoryOptions, getActiveTerms, getCategories } from "@/server/modules/taxonomy/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketplace.search");
  return { title: t("title") };
}

export default function SearchPage({ searchParams }: PageProps<"/[locale]/search">) {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6">
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/search">["searchParams"];
}) {
  const filters = parseListingFilters(await searchParams);
  const [t, tSave, locale] = await Promise.all([
    getTranslations("marketplace.search"),
    getTranslations("marketplace.save"),
    getLocale(),
  ]);
  const [results, categories, terms] = await Promise.all([
    searchListings(filters),
    getCategories(locale),
    getActiveTerms(locale),
  ]);
  const savedQuery = Object.fromEntries(
    Object.entries({
      q: filters.q,
      category: filters.category,
      skill: filters.skill,
      currency: filters.currency,
      min: filters.min,
      max: filters.max,
      delivery: filters.delivery,
      type: filters.type,
      country: filters.country,
      language: filters.language,
      model: filters.model,
    })
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );

  return (
    <>
      <div className="grid gap-4">
        <h1 className="font-display text-3xl font-semibold">
          {filters.q ? t("titleWithQuery", { query: filters.q }) : t("title")}
        </h1>
        <div className="flex max-w-2xl flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <SearchBox defaultValue={filters.q} />
          </div>
          <Suspense>
            <SaveSearch
              kind="services"
              query={savedQuery}
              defaultName={filters.q ?? tSave("defaultSearchName")}
              returnTo={`/search${listingFilterQuery(filters, 1)}`}
            />
          </Suspense>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside className="rounded-lg border border-line bg-surface p-4 lg:self-start">
          <ListingFiltersForm
            action="/search"
            filters={filters}
            categories={categoryOptions(categories).map((o) => ({ value: o.id, label: o.label }))}
            skills={workTerms(terms).map((term) => ({ value: term.id, label: term.name }))}
          />
        </aside>
        <section aria-labelledby="results-heading" className="grid content-start gap-5">
          <h2
            id="results-heading"
            className="text-sm font-medium text-ink-muted"
            aria-live="polite"
          >
            {t("results", { count: results.total })}
          </h2>
          {results.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-surface p-8 text-center">
              <p className="font-medium">{t("empty")}</p>
              <p className="mt-1 text-sm text-ink-muted">{t("emptyHint")}</p>
              <Link
                href="/categories"
                className="mt-3 inline-block text-sm text-accent hover:underline"
              >
                {t("title")}
              </Link>
            </div>
          ) : (
            <CardGrid>
              {results.items.map((item) => (
                <ListingCard key={item.listing_id} item={item} />
              ))}
            </CardGrid>
          )}
          <Pagination
            page={filters.page}
            total={results.total}
            pageSize={PAGE_SIZE}
            hrefFor={(page) => `/search${listingFilterQuery(filters, page)}`}
          />
        </section>
      </div>
    </>
  );
}
