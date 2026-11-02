import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CategoryForm, InlineAction, ReassignForm } from "@/components/admin/admin-forms";
import { EditorSection } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { reassignCategoryAction, saveCategoryAction, setCategoryActiveAction } from "@/server/modules/admin/actions";
import { categoryPathOptions } from "@/server/modules/admin/category-options";
import { listAllCategories } from "@/server/modules/admin/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.categories");
  return { title: t("editTitle") };
}

export default function EditCategoryPage({ params }: PageProps<"/[locale]/admin/categories/[id]">) {
  return (
    <Suspense>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff(["super_admin", "admin"], `/admin/categories/${id}`);
  const session = await getSessionClaims();
  const [t, locale] = await Promise.all([getTranslations("admin.categories"), getLocale()]);
  if (!session) return null;
  const categories = await listAllCategories(session.supabase, locale);
  const category = categories.find((c) => c.id === id);
  if (!category) notFound();

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <Link href="/admin/categories" className="text-sm text-accent hover:underline">
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold">{category.name}</h1>
          {!category.isActive ? <Badge variant="warning">{t("inactive")}</Badge> : null}
        </div>
        <div>
          <InlineAction
            action={setCategoryActiveAction}
            fields={{ id: category.id, active: category.isActive ? "0" : "1" }}
            label={category.isActive ? t("deactivate") : t("activate")}
          />
        </div>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <CategoryForm
          action={saveCategoryAction.bind(null, category.id)}
          parents={categoryPathOptions(categories, category.id)}
          values={{
            parentId: category.parentId,
            slug: category.slug,
            name: category.name,
            shortDescription: category.shortDescription,
            description: category.description,
            iconKey: category.iconKey,
            sortOrder: category.sortOrder,
            isVisible: category.isVisible,
          }}
        />
      </div>
      <EditorSection id="reassign" title={t("reassign.title")} description={t("reassign.description")}>
        <ReassignForm
          action={reassignCategoryAction.bind(null, category.id)}
          targets={categoryPathOptions(categories, category.id, true)}
        />
      </EditorSection>
    </div>
  );
}
