import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";

import { getPublicEnv } from "@/lib/env";
import { createSupabaseAnonClient } from "@/server/db/supabase-server";
import { CATALOG_TAG, getCategories, softFail, visibleCategories } from "@/server/modules/taxonomy/service";

async function publicEntries() {
  "use cache";
  cacheTag(CATALOG_TAG);
  const supabase = createSupabaseAnonClient();
  const [providers, listings] = await Promise.all([
    supabase.from("providers").select("handle, published_at").eq("status", "active").limit(5000),
    supabase
      .from("service_listings")
      .select("slug, updated_at, providers!inner (handle, status)")
      .eq("status", "published")
      .eq("providers.status", "active")
      .limit(10000),
  ]);
  const error = providers.error ?? listings.error;
  if (error) return softFail("sitemap", error, { providers: [], listings: [] });
  cacheLife("hours");
  return {
    providers: (providers.data ?? []).map((p) => ({ handle: p.handle, date: p.published_at })),
    listings: (listings.data ?? []).map((l) => ({ handle: l.providers.handle, slug: l.slug, date: l.updated_at })),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const [entries, categories] = await Promise.all([publicEntries(), getCategories("en")]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/categories`, changeFrequency: "weekly" },
    { url: `${base}/experts`, changeFrequency: "daily" },
    { url: `${base}/how-it-works`, changeFrequency: "monthly" },
    { url: `${base}/become-an-expert`, changeFrequency: "monthly" },
    ...visibleCategories(categories).map((c) => ({ url: `${base}/categories/${c.urlPath}`, changeFrequency: "weekly" as const })),
    ...entries.providers.map((p) => ({ url: `${base}/experts/${p.handle}`, lastModified: p.date ?? undefined })),
    ...entries.listings.map((l) => ({ url: `${base}/experts/${l.handle}/${l.slug}`, lastModified: l.date })),
  ];
}
