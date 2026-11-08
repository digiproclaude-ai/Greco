import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { NewProjectForm } from "@/components/projects/project-forms";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth/guards";
import { createProjectAction } from "@/server/modules/projects/actions";
import { categoryOptions, getCategories } from "@/server/modules/taxonomy/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects.new");
  return { title: t("title") };
}

export default async function NewProjectPage() {
  await requireRole("client", "/dashboard/client/projects/new");
  const [t, locale] = await Promise.all([getTranslations("projects"), getLocale()]);
  const categories = categoryOptions(await getCategories(locale)).map((option) => ({ value: option.id, label: option.label }));
  return (
    <div className="grid max-w-2xl gap-6">
      <div className="grid gap-2">
        <Link href="/dashboard/client/projects" className="text-sm text-accent hover:underline">
          {t("client.back")}
        </Link>
        <h1 className="font-display text-3xl font-semibold">{t("new.title")}</h1>
        <p className="text-ink-muted">{t("new.intro")}</p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <NewProjectForm action={createProjectAction} categories={categories} />
      </div>
    </div>
  );
}
