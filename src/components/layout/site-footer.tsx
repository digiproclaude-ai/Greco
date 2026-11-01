import { cacheLife } from "next/cache";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getUTCFullYear();
}

export async function SiteFooter() {
  const [t, year] = await Promise.all([getTranslations("nav.footer"), currentYear()]);
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm text-ink-muted sm:px-6">
        <p>{t("copyright", { year })}</p>
        <nav aria-label={t("legal")} className="flex gap-5">
          <Link href="/legal/terms" className="hover:text-ink">
            {t("terms")}
          </Link>
          <Link href="/legal/privacy" className="hover:text-ink">
            {t("privacy")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
