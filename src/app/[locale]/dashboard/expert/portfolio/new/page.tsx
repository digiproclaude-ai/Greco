import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { EMPTY_PORTFOLIO, PortfolioItemForm } from "@/components/expert/portfolio-forms";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth/guards";
import { createPortfolioItemAction } from "@/server/modules/portfolio/actions";
import { MAX_PORTFOLIO_TERMS } from "@/server/modules/portfolio/schemas";
import { industryOptions, termKindLabels, workTerms } from "@/server/modules/taxonomy/labels";
import { getActiveTerms } from "@/server/modules/taxonomy/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expert.portfolio");
  return { title: t("newTitle") };
}

export default async function NewPortfolioItemPage() {
  await requireRole("expert", "/dashboard/expert/portfolio/new");
  const [t, locale] = await Promise.all([getTranslations("expert.portfolio"), getLocale()]);
  const [terms, kindLabels] = await Promise.all([getActiveTerms(locale), termKindLabels()]);
  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <Link href="/dashboard/expert/portfolio" className="text-sm text-accent hover:underline">
          {t("back")}
        </Link>
        <h1 className="font-display text-3xl font-semibold">{t("newTitle")}</h1>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <PortfolioItemForm
          action={createPortfolioItemAction}
          values={EMPTY_PORTFOLIO}
          industries={industryOptions(terms)}
          terms={workTerms(terms)}
          kindLabels={kindLabels}
          maxTerms={MAX_PORTFOLIO_TERMS}
          submitLabel={t("new")}
        />
      </div>
    </div>
  );
}
