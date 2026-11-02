import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CardGrid, ListingCard } from "@/components/marketplace/cards";
import { ListingFiltersForm } from "@/components/marketplace/filters";
import { Pagination } from "@/components/marketplace/pagination";
import { ResultsSkeleton } from "@/components/marketplace/results-skeleton";
import { SearchBox } from "@/components/marketplace/search-box";
import { Link } from "@/i18n/navigation";
import { listingFilterQuery, PAGE_SIZE, parseListingFilters, searchListings } from "@/server/modules/marketplace/search";
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

async function Results({ searchParams }: { searchParams: PageProps<"/[locale]/search">["searchParams"] }) {
  const filters = parseListingFilters(await searchParams);
  const [t, locale] = await Promise.all([getTranslations("marketplace.search"), getLocale()]);
  const [results, categories, terms] = await Promise.all([searchListings(filters), getCategories(locale), getActiveTerms(locale)]);

  return (
    <>
      <div className="grid gap-4">
        <h1 className="font-display text-3xl font-semibold">{filters.q ? t("titleWithQuery", { query: filters.q }) : t("title")}</h1>
        <div className="max-w-2xl">
          <SearchBox defaultValue={filters.q} />
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
          <h2 id="results-heading" className="text-sm font-medium text-ink-muted" aria-live="polite">
            {t("results", { count: results.total })}
          </h2>
          {results.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-surface p-8 text-center">
              <p className="font-medium">{t("empty")}</p>
              <p className="mt-1 text-sm text-ink-muted">{t("emptyHint")}</p>
              <Link href="/categories" className="mt-3 inline-block text-sm text-accent hover:underline">
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
