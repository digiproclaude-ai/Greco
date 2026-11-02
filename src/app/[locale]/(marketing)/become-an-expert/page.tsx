import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatBps, getMarketplaceSettings } from "@/server/modules/settings/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketplace.becomeExpert");
  return { title: t("title"), description: t("intro") };
}

const BENEFITS = ["clients", "terms", "fees"] as const;
const STEPS = ["account", "profile", "service", "review"] as const;

export default async function BecomeExpertPage() {
  const t = await getTranslations("marketplace.becomeExpert");
  return (
    <div className="mx-auto grid max-w-4xl gap-12 px-4 py-14 sm:px-6">
      <div className="grid gap-4">
        <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
        <p className="text-lg text-ink-muted">{t("intro")}</p>
        <div>
          <Button asChild size="lg">
            <Link href="/register?role=expert">{t("cta")}</Link>
          </Button>
        </div>
      </div>
      <Suspense>
        <Benefits />
      </Suspense>
      <section aria-labelledby="steps" className="grid gap-4">
        <h2 id="steps" className="font-display text-2xl font-semibold">
          {t("stepsTitle")}
        </h2>
        <ol className="grid list-decimal gap-2 ps-5">
          {STEPS.map((step) => (
            <li key={step}>{t(`steps.${step}`)}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

async function Benefits() {
  const [t, locale, settings] = await Promise.all([getTranslations("marketplace.becomeExpert"), getLocale(), getMarketplaceSettings()]);
  const commission = formatBps(settings.commissionBps, locale);
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {BENEFITS.map((benefit) => (
        <li key={benefit} className="grid content-start gap-2 rounded-lg border border-line bg-surface p-5">
          <p className="font-semibold">{t(`benefits.${benefit}.title`)}</p>
          <p className="text-[15px] text-ink-muted">{t(`benefits.${benefit}.body`, { commission })}</p>
        </li>
      ))}
    </ul>
  );
}
