import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CardGrid, ListingCard } from "@/components/marketplace/cards";
import { ResultsSkeleton } from "@/components/marketplace/results-skeleton";
import { SearchBox } from "@/components/marketplace/search-box";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { emptyListingFilters, searchListings } from "@/server/modules/marketplace/search";
import { formatBps, getMarketplaceSettings } from "@/server/modules/settings/service";
import { buildCategoryTree, getCategories, getCategoryCounts, visibleCategories } from "@/server/modules/taxonomy/service";

const PILLARS = ["terms", "payment", "disputes"] as const;
const HOW = ["describe", "compare", "work"] as const;

export default async function HomePage() {
  const [t, tMarket] = await Promise.all([getTranslations("home"), getTranslations("marketplace.home")]);
  return (
    <div className="mx-auto grid max-w-7xl gap-16 px-4 pb-16 sm:px-6">
      <section className="grid gap-12 pt-16 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:pt-24">
        <div className="grid content-start gap-6">
          <h1 className="max-w-[15ch] font-display text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
            {t("headline")}
          </h1>
          <p className="max-w-[58ch] text-lg text-ink-muted">{t("lede")}</p>
          <div className="max-w-xl">
            <SearchBox size="lg" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/categories">{t("ctaClient")}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/become-an-expert">{t("ctaExpert")}</Link>
            </Button>
          </div>
          <Alert className="max-w-[62ch]">{t("betaNote")}</Alert>
        </div>

        <aside aria-labelledby="pillars" className="grid content-center gap-5 border-line md:border-s md:ps-8">
          <h2 id="pillars" className="font-display text-xl font-semibold">
            {t("pillarsTitle")}
          </h2>
          <ol className="grid gap-4">
            {PILLARS.map((pillar, index) => (
              <li key={pillar} className="grid grid-cols-[28px_1fr] gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-6 place-items-center rounded-full border border-accent font-mono text-xs text-accent"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="font-semibold">{t(`pillars.${pillar}.title`)}</p>
                  <p className="text-[15px] text-ink-muted">{t(`pillars.${pillar}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section aria-labelledby="browse" className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="browse" className="font-display text-2xl font-semibold">
            {tMarket("browseTitle")}
          </h2>
          <Link href="/categories" className="text-sm text-accent hover:underline">
            {tMarket("browseAll")}
          </Link>
        </div>
        <Suspense fallback={<Skeleton className="h-48 rounded-lg" />}>
          <TopCategories />
        </Suspense>
      </section>

      <section aria-labelledby="latest" className="grid gap-5">
        <h2 id="latest" className="font-display text-2xl font-semibold">
          {tMarket("latestTitle")}
        </h2>
        <Suspense fallback={<ResultsSkeleton count={3} />}>
          <LatestServices emptyText={tMarket("latestEmpty")} />
        </Suspense>
      </section>

      <section aria-labelledby="how" className="grid gap-6 rounded-lg border border-line bg-surface p-6 sm:p-8">
        <h2 id="how" className="font-display text-2xl font-semibold">
          {tMarket("howTitle")}
        </h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {HOW.map((step, index) => (
            <li key={step} className="grid content-start gap-2">
              <span className="font-mono text-sm text-accent">{`0${index + 1}`}</span>
              <p className="font-semibold">{tMarket(`how.${step}.title`)}</p>
              <p className="text-[15px] text-ink-muted">{tMarket(`how.${step}.body`)}</p>
            </li>
          ))}
        </ol>
        <Link href="/how-it-works" className="text-sm text-accent hover:underline">
          {tMarket("howLink")}
        </Link>
      </section>

      <Suspense>
        <ExpertCta />
      </Suspense>
    </div>
  );
}

async function TopCategories() {
  const [t, locale] = await Promise.all([getTranslations("marketplace.categories"), getLocale()]);
  const [categories, counts] = await Promise.all([getCategories(locale), getCategoryCounts()]);
  const tree = buildCategoryTree(visibleCategories(categories)).slice(0, 12);
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tree.map((category) => (
        <li key={category.id}>
          <Link
            href={`/categories/${category.urlPath}`}
            className="grid h-full gap-1 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-accent"
          >
            <span className="font-medium">{category.name}</span>
            <span className="text-xs text-ink-subtle">{t("services", { count: counts[category.id] ?? 0 })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function LatestServices({ emptyText }: { emptyText: string }) {
  const results = await searchListings({ ...emptyListingFilters(), limit: 6 });
  if (results.items.length === 0) {
    return <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-ink-muted">{emptyText}</p>;
  }
  return (
    <CardGrid>
      {results.items.map((item) => (
        <ListingCard key={item.listing_id} item={item} />
      ))}
    </CardGrid>
  );
}

async function ExpertCta() {
  const [t, locale, settings] = await Promise.all([getTranslations("marketplace.home"), getLocale(), getMarketplaceSettings()]);
  return (
    <section aria-labelledby="expert-cta" className="grid gap-3 rounded-lg bg-accent-tint p-6 sm:p-8">
      <h2 id="expert-cta" className="font-display text-2xl font-semibold">
        {t("expertCta")}
      </h2>
      <p className="max-w-[62ch] text-ink-muted">{t("expertCtaBody", { commission: formatBps(settings.commissionBps, locale) })}</p>
      <div>
        <Button asChild>
          <Link href="/become-an-expert">{t("expertCtaButton")}</Link>
        </Button>
      </div>
    </section>
  );
}
