import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatBps, getMarketplaceSettings } from "@/server/modules/settings/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketplace.howItWorks");
  return { title: t("title"), description: t("intro") };
}

const CLIENT_STEPS = ["find", "agree", "pay", "deliver"] as const;
const EXPERT_STEPS = ["profile", "services", "earn"] as const;

export default async function HowItWorksPage() {
  const t = await getTranslations("marketplace.howItWorks");
  return (
    <div className="mx-auto grid max-w-4xl gap-12 px-4 py-14 sm:px-6">
      <div className="grid gap-3">
        <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
        <p className="text-lg text-ink-muted">{t("intro")}</p>
      </div>
      <section aria-labelledby="clients" className="grid gap-5">
        <h2 id="clients" className="font-display text-2xl font-semibold">
          {t("clientsTitle")}
        </h2>
        <ol className="grid gap-5">
          {CLIENT_STEPS.map((step, index) => (
            <li key={step} className="grid grid-cols-[2rem_1fr] gap-3">
              <span className="font-mono text-accent">{index + 1}</span>
              <div className="grid gap-1">
                <p className="font-semibold">{t(`clients.${step}.title`)}</p>
                <p className="text-ink-muted">{t(`clients.${step}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="experts" className="grid gap-5">
        <h2 id="experts" className="font-display text-2xl font-semibold">
          {t("expertsTitle")}
        </h2>
        <Suspense>
          <ExpertSteps />
        </Suspense>
      </section>
      <section aria-labelledby="trust" className="grid gap-2 rounded-lg border border-line bg-surface p-6">
        <h2 id="trust" className="font-semibold">
          {t("trustTitle")}
        </h2>
        <p className="text-ink-muted">{t("trust")}</p>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/categories">{t("ctaClient")}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/become-an-expert">{t("ctaExpert")}</Link>
        </Button>
      </div>
    </div>
  );
}

async function ExpertSteps() {
  const [t, locale, settings] = await Promise.all([getTranslations("marketplace.howItWorks"), getLocale(), getMarketplaceSettings()]);
  const commission = formatBps(settings.commissionBps, locale);
  return (
    <ol className="grid gap-5">
      {EXPERT_STEPS.map((step, index) => (
        <li key={step} className="grid grid-cols-[2rem_1fr] gap-3">
          <span className="font-mono text-accent">{index + 1}</span>
          <div className="grid gap-1">
            <p className="font-semibold">{t(`experts.${step}.title`)}</p>
            <p className="text-ink-muted">{t(`experts.${step}.body`, { commission })}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
