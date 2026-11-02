import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { createSupabaseAnonClient } from "@/server/db/supabase-server";
import type { Enums } from "@/server/db/types";

/** Cache tags. Admin actions update them; experts' edits revalidate "catalog". */
export const TAXONOMY_TAG = "taxonomy";
export const CATALOG_TAG = "catalog";

export type TermKind = Enums<"term_kind">;

export type Category = {
  id: string;
  parentId: string | null;
  slug: string;
  /** URL path below /categories, for example "voice-agents-phone/ai-receptionists". */
  urlPath: string;
  depth: number;
  name: string;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  iconKey: string | null;
  sortOrder: number;
  isVisible: boolean;
  isActive: boolean;
};

export type CategoryNode = Category & { children: CategoryNode[] };

export type Term = { id: string; kind: TermKind; slug: string; name: string };

type Localised = { locale: string };

export function pickTranslation<T extends Localised>(rows: T[] | null | undefined, locale: string): T | undefined {
  if (!rows || rows.length === 0) return undefined;
  return rows.find((row) => row.locale === locale) ?? rows.find((row) => row.locale === "en") ?? rows[0];
}

type CategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
  depth: number;
  icon_key: string | null;
  sort_order: number;
  is_visible: boolean;
  is_active: boolean;
  category_translations: {
    locale: string;
    name: string;
    short_description: string | null;
    description: string | null;
    seo_title: string | null;
    seo_description: string | null;
  }[];
};

export const CATEGORY_SELECT =
  "id, parent_id, slug, depth, icon_key, sort_order, is_visible, is_active, category_translations (locale, name, short_description, description, seo_title, seo_description)";

/** Turn category rows into localised categories with URL paths, ordered for display. */
export function toCategories(rows: CategoryRow[], locale: string): Category[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const urlPath = (row: CategoryRow): string => {
    const parts: string[] = [];
    let current: CategoryRow | undefined = row;
    let guard = 0;
    while (current && guard++ < 10) {
      parts.unshift(current.slug);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return parts.join("/");
  };
  return rows
    .map((row) => {
      const t = pickTranslation(row.category_translations, locale);
      return {
        id: row.id,
        parentId: row.parent_id,
        slug: row.slug,
        urlPath: urlPath(row),
        depth: row.depth,
        name: t?.name ?? row.slug,
        shortDescription: t?.short_description ?? null,
        description: t?.description ?? null,
        seoTitle: t?.seo_title ?? null,
        seoDescription: t?.seo_description ?? null,
        iconKey: row.icon_key,
        sortOrder: row.sort_order,
        isVisible: row.is_visible,
        isActive: row.is_active,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/** Active categories (anonymous view), cached for an hour and refreshed by admin changes. */
export async function getCategories(locale: string): Promise<Category[]> {
  "use cache";
  cacheTag(TAXONOMY_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabaseAnonClient().from("categories").select(CATEGORY_SELECT);
  // Throwing keeps a failed read out of the cache.
  if (error) throw new Error(`Could not load categories: ${error.message}`);
  return toCategories(data as CategoryRow[], locale);
}

export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(categories.map((c) => [c.id, { ...c, children: [] }]));
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else if (!node.parentId) roots.push(node);
  }
  const sort = (list: CategoryNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    list.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

/** Categories offered in navigation and pickers: active, visible, with visible ancestors. */
export function visibleCategories(categories: Category[]): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return categories.filter((category) => {
    let current: Category | undefined = category;
    while (current) {
      if (!current.isVisible || !current.isActive) return false;
      if (!current.parentId) return true;
      current = byId.get(current.parentId);
    }
    // The parent is missing (deactivated, so not readable): hide the child too.
    return false;
  });
}

/** Options for a category <select>, labelled "Parent › Child". */
export function categoryOptions(categories: Category[]): { id: string; label: string; depth: number }[] {
  const tree = buildCategoryTree(visibleCategories(categories));
  const options: { id: string; label: string; depth: number }[] = [];
  const walk = (nodes: CategoryNode[], prefix: string) => {
    for (const node of nodes) {
      const label = prefix ? `${prefix} › ${node.name}` : node.name;
      options.push({ id: node.id, label, depth: node.depth });
      walk(node.children, label);
    }
  };
  walk(tree, "");
  return options;
}

export function findCategoryByPath(categories: Category[], segments: string[]): Category | undefined {
  const path = segments.map((s) => decodeURIComponent(s).toLowerCase()).join("/");
  return categories.find((category) => category.urlPath === path);
}

export function categoryAncestors(categories: Category[], category: Category): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain: Category[] = [];
  let current = category.parentId ? byId.get(category.parentId) : undefined;
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

type TermRow = { id: string; kind: TermKind; slug: string; taxonomy_term_translations: { locale: string; name: string }[] };

/** Active taxonomy terms (skills, technologies, industries…), cached and sorted by name. */
export async function getActiveTerms(locale: string): Promise<Term[]> {
  "use cache";
  cacheTag(TAXONOMY_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabaseAnonClient()
    .from("taxonomy_terms")
    .select("id, kind, slug, taxonomy_term_translations (locale, name)")
    .eq("status", "active");
  if (error) throw new Error(`Could not load taxonomy: ${error.message}`);
  const collator = new Intl.Collator(locale);
  return (data as TermRow[])
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      slug: row.slug,
      name: pickTranslation(row.taxonomy_term_translations, locale)?.name ?? row.slug,
    }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** Live listing counts per category (whole subtree), refreshed every few minutes. */
export async function getCategoryCounts(): Promise<Record<string, number>> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("minutes");
  const { data, error } = await createSupabaseAnonClient().rpc("category_listing_counts");
  if (error) throw new Error(`Could not load category counts: ${error.message}`);
  return Object.fromEntries(data.map((row) => [row.category_id, Number(row.listing_count)]));
}
