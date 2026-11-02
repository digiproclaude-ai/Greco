import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { InlineAction } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { setCategoryActiveAction } from "@/server/modules/admin/actions";
import { listAllCategories } from "@/server/modules/admin/service";
import { buildCategoryTree, type CategoryNode } from "@/server/modules/taxonomy/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.categories");
  return { title: t("title") };
}

export default async function AdminCategoriesPage() {
  await requireStaff(["super_admin", "admin"], "/admin/categories");
  const session = await getSessionClaims();
  const [t, locale] = await Promise.all([getTranslations("admin.categories"), getLocale()]);
  if (!session) return null;
  const tree = buildCategoryTree(await listAllCategories(session.supabase, locale));

  const rows: { node: CategoryNode; depth: number }[] = [];
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      rows.push({ node, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);

  return (
    <div className="grid max-w-4xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
          <p className="text-ink-muted">{t("intro")}</p>
        </div>
        <Button asChild>
          <Link href="/admin/categories/new">{t("new")}</Link>
        </Button>
      </div>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {rows.map(({ node, depth }) => (
          <li key={node.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 pe-4" style={{ paddingInlineStart: `${1 + depth * 1.5}rem` }}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={depth === 0 ? "font-semibold" : ""}>{node.name}</span>
              <span className="font-mono text-xs text-ink-subtle">{node.urlPath}</span>
              {!node.isActive ? <Badge variant="warning">{t("inactive")}</Badge> : null}
              {!node.isVisible ? <Badge>{t("hidden")}</Badge> : null}
            </div>
            <div className="flex gap-2">
              <InlineAction
                action={setCategoryActiveAction}
                fields={{ id: node.id, active: node.isActive ? "0" : "1" }}
                label={node.isActive ? t("deactivate") : t("activate")}
                variant="ghost"
              />
              <Button asChild size="sm" variant="secondary">
                <Link href={`/admin/categories/${node.id}`}>{t("edit")}</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
