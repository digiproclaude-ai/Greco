import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CardGrid, ProviderCard } from "@/components/marketplace/cards";
import { ProviderFiltersForm } from "@/components/marketplace/filters";
import { Pagination } from "@/components/marketplace/pagination";
import { ResultsSkeleton } from "@/components/marketplace/results-skeleton";
import { SearchBox } from "@/components/marketplace/search-box";
import { PAGE_SIZE, parseProviderFilters, searchProviders, toQuery } from "@/server/modules/marketplace/search";
import { workTerms } from "@/server/modules/taxonomy/labels";
import { categoryOptions, getActiveTerms, getCategories } from "@/server/modules/taxonomy/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketplace.experts");
  return { title: t("title"), description: t("intro") };
}

export default function ExpertsPage({ searchParams }: PageProps<"/[locale]/experts">) {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6">
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/[locale]/experts">["searchParams"] }) {
  const filters = parseProviderFilters(await searchParams);
  const [t, locale] = await Promise.all([getTranslations("marketplace.experts"), getLocale()]);
  const [results, categories, terms] = await Promise.all([searchProviders(filters), getCategories(locale), getActiveTerms(locale)]);
  const query = (page: number) =>
    toQuery({
      q: filters.q,
      category: filters.category,
      skill: filters.skill,
      type: filters.type,
      country: filters.country,
      language: filters.language,
      sort: filters.sort === (filters.q ? "relevance" : "newest") ? null : filters.sort,
      page,
    });

  return (
    <>
      <div className="grid gap-3">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-ink-muted">{t("intro")}</p>
        <div className="max-w-2xl">
          <SearchBox action="/experts" defaultValue={filters.q} placeholder={t("placeholder")} />
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside className="rounded-lg border border-line bg-surface p-4 lg:self-start">
          <ProviderFiltersForm
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
            <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-ink-muted">{t("empty")}</p>
          ) : (
            <CardGrid>
              {results.items.map((item) => (
                <ProviderCard key={item.provider_id} item={item} />
              ))}
            </CardGrid>
          )}
          <Pagination page={filters.page} total={results.total} pageSize={PAGE_SIZE} hrefFor={(page) => `/experts${query(page)}`} />
        </section>
      </div>
    </>
  );
}
