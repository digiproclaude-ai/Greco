import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { CategoryForm } from "@/components/admin/admin-forms";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { saveCategoryAction } from "@/server/modules/admin/actions";
import { categoryPathOptions } from "@/server/modules/admin/category-options";
import { listAllCategories } from "@/server/modules/admin/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.categories");
  return { title: t("newTitle") };
}

export default async function NewCategoryPage() {
  await requireStaff(["super_admin", "admin"], "/admin/categories/new");
  const session = await getSessionClaims();
  const [t, locale] = await Promise.all([getTranslations("admin.categories"), getLocale()]);
  if (!session) return null;
  const categories = await listAllCategories(session.supabase, locale);
  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <Link href="/admin/categories" className="text-sm text-accent hover:underline">
          {t("back")}
        </Link>
        <h1 className="font-display text-3xl font-semibold">{t("newTitle")}</h1>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <CategoryForm
          action={saveCategoryAction.bind(null, null)}
          parents={categoryPathOptions(categories)}
          values={{ parentId: null, slug: "", name: "", shortDescription: null, description: null, iconKey: null, sortOrder: 0, isVisible: true }}
        />
      </div>
    </div>
  );
}
