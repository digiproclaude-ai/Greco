import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/marketplace/breadcrumbs";
import { CardGrid, ListingCard } from "@/components/marketplace/cards";
import { ListingFiltersForm } from "@/components/marketplace/filters";
import { Pagination } from "@/components/marketplace/pagination";
import { ResultsSkeleton } from "@/components/marketplace/results-skeleton";
import { SaveButton } from "@/components/marketplace/save-button";
import { Prose } from "@/components/marketplace/prose";
import { Link } from "@/i18n/navigation";
import { listingFilterQuery, PAGE_SIZE, parseListingFilters, searchListings } from "@/server/modules/marketplace/search";
import { workTerms } from "@/server/modules/taxonomy/labels";
import {
  buildCategoryTree,
  categoryAncestors,
  findCategoryByPath,
  getActiveTerms,
  getCategories,
  getCategoryCounts,
  visibleCategories,
} from "@/server/modules/taxonomy/service";

type Props = PageProps<"/[locale]/categories/[...path]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ path }, locale] = await Promise.all([params, getLocale()]);
  const category = findCategoryByPath(await getCategories(locale), path);
  if (!category) return {};
  return {
    title: category.seoTitle ?? category.name,
    description: category.seoDescription ?? category.shortDescription ?? undefined,
    alternates: { canonical: `/categories/${category.urlPath}` },
  };
}

export default function CategoryPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6">
      <Suspense fallback={<ResultsSkeleton />}>
        <Category params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Category({ params, searchParams }: Props) {
  const [{ path }, raw, locale, t] = await Promise.all([params, searchParams, getLocale(), getTranslations("marketplace.categories")]);
  const categories = await getCategories(locale);
  const category = findCategoryByPath(categories, path);
  if (!category || !category.isActive) notFound();

  const filters = { ...parseListingFilters(raw), category: category.id };
  const [results, terms, counts] = await Promise.all([searchListings(filters), getActiveTerms(locale), getCategoryCounts()]);
  const ancestors = categoryAncestors(categories, category);
  const node = buildCategoryTree(visibleCategories(categories))
    .flatMap(function flatten(n): typeof n[] {
      return [n, ...n.children.flatMap(flatten)];
    })
    .find((n) => n.id === category.id);
  const base = `/categories/${category.urlPath}`;

  return (
    <>
      <div className="grid gap-4">
        <Breadcrumbs
          items={[
            { label: t("home"), href: "/" },
            { label: t("title"), href: "/categories" },
            ...ancestors.map((a) => ({ label: a.name, href: `/categories/${a.urlPath}` })),
            { label: category.name },
          ]}
        />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <h1 className="font-display text-3xl font-semibold">{category.name}</h1>
            {category.shortDescription ? <p className="max-w-[68ch] text-lg text-ink-muted">{category.shortDescription}</p> : null}
          </div>
          <Suspense>
            <SaveButton kind="category" id={category.id} returnTo={base} />
          </Suspense>
        </div>
        <Prose text={category.description} className="grid max-w-[68ch] gap-3 text-ink-muted" />
        {node && node.children.length > 0 ? (
          <nav aria-label={t("subcategories")}>
            <ul className="flex flex-wrap gap-2">
              {node.children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/categories/${child.urlPath}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                  >
                    {child.name}
                    <span className="text-ink-subtle">{counts[child.id] ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside className="rounded-lg border border-line bg-surface p-4 lg:self-start">
          <ListingFiltersForm
            action={base}
            filters={filters}
            categories={[]}
            skills={workTerms(terms).map((term) => ({ value: term.id, label: term.name }))}
            showCategory={false}
          />
        </aside>
        <section aria-labelledby="results-heading" className="grid content-start gap-5">
          <h2 id="results-heading" className="font-semibold">
            {t("servicesIn", { name: category.name })}
          </h2>
          {results.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-surface p-8 text-center">
              <p className="font-medium">{t("empty")}</p>
              <p className="mt-1 text-sm text-ink-muted">{t("emptyHint")}</p>
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
            hrefFor={(page) => `${base}${listingFilterQuery(filters, page, true)}`}
          />
        </section>
      </div>
    </>
  );
}
