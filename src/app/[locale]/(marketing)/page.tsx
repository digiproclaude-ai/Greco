import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const PILLARS = ["terms", "payment", "disputes"] as const;

export default function HomePage() {
  const t = useTranslations("home");
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="grid gap-12 py-16 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:py-24">
        <div className="grid content-start gap-6">
          <h1 className="max-w-[15ch] font-display text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
            {t("headline")}
          </h1>
          <p className="max-w-[58ch] text-lg text-ink-muted">{t("lede")}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register?role=client">{t("ctaClient")}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/register?role=expert">{t("ctaExpert")}</Link>
            </Button>
          </div>
          <Alert className="max-w-[62ch]">{t("betaNote")}</Alert>
        </div>

        <aside aria-labelledby="pillars" className="grid content-center gap-5 border-line md:border-s md:ps-8">
          <h2 id="pillars" className="font-display text-xl font-semibold">
            {t("pillarsTitle")}
          </h2>
          <ol className="grid gap-4">
            {PILLARS.map((pillar, index) => (
              <li key={pillar} className="grid grid-cols-[28px_1fr] gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-6 place-items-center rounded-full border border-accent font-mono text-xs text-accent"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="font-semibold">{t(`pillars.${pillar}.title`)}</p>
                  <p className="text-[15px] text-ink-muted">{t(`pillars.${pillar}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </div>
  );
}
