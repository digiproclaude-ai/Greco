import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { buildCategoryTree, getCategories, getCategoryCounts, visibleCategories } from "@/server/modules/taxonomy/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketplace.categories");
  return { title: t("title"), description: t("intro") };
}

export default async function CategoriesPage() {
  const t = await getTranslations("marketplace.categories");
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-ink-muted">{t("intro")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <CategoryGrid />
      </Suspense>
    </div>
  );
}

async function CategoryGrid() {
  const [t, locale] = await Promise.all([getTranslations("marketplace.categories"), getLocale()]);
  const [categories, counts] = await Promise.all([getCategories(locale), getCategoryCounts()]);
  const tree = buildCategoryTree(visibleCategories(categories));
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tree.map((category) => (
        <li key={category.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
          <div className="grid gap-1">
            <h2 className="font-semibold">
              <Link href={`/categories/${category.urlPath}`} className="hover:text-accent">
                {category.name}
              </Link>
            </h2>
            {category.shortDescription ? <p className="text-sm text-ink-muted">{category.shortDescription}</p> : null}
            <p className="text-xs text-ink-subtle">{t("services", { count: counts[category.id] ?? 0 })}</p>
          </div>
          {category.children.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {category.children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/categories/${child.urlPath}`}
                    className="inline-block rounded-full border border-line px-2.5 py-1 text-sm hover:border-accent hover:text-accent"
                  >
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
