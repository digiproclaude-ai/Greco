import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { NewListingForm } from "@/components/expert/new-listing-form";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth/guards";
import { categoryOptions, getCategories } from "@/server/modules/taxonomy/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("listing.new");
  return { title: t("title") };
}

export default async function NewServicePage() {
  await requireRole("expert", "/dashboard/expert/services/new");
  const [t, tServices, locale] = await Promise.all([getTranslations("listing.new"), getTranslations("expert.services"), getLocale()]);
  const categories = categoryOptions(await getCategories(locale)).map((option) => ({ value: option.id, label: option.label }));
  return (
    <div className="grid max-w-2xl gap-6">
      <div className="grid gap-2">
        <Link href="/dashboard/expert/services" className="text-sm text-accent hover:underline">
          {tServices("back")}
        </Link>
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-ink-muted">{t("intro")}</p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <NewListingForm categories={categories} />
      </div>
    </div>
  );
}
