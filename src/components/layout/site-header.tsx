import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { Link } from "@/i18n/navigation";

import { GuestActions, HeaderAuth } from "./header-auth";
import { Logo } from "./logo";

export function SiteHeader() {
  const t = useTranslations("nav");
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-7 gap-y-3 px-4 py-3.5 sm:px-6">
        <Logo />
        <nav aria-label={t("mainLabel")} className="order-last flex w-full gap-5 overflow-x-auto text-[15px] md:order-none md:w-auto md:gap-6">
          <Link href="/categories" className="shrink-0 hover:text-accent">
            {t("categories")}
          </Link>
          <Link href="/experts" className="shrink-0 hover:text-accent">
            {t("findExperts")}
          </Link>
          <Link href="/how-it-works" className="shrink-0 hover:text-accent">
            {t("howItWorks")}
          </Link>
          <Link href="/become-an-expert" className="shrink-0 hover:text-accent">
            {t("becomeExpert")}
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <Suspense fallback={<GuestActions login={t("login")} signup={t("signup")} />}>
            <HeaderAuth />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
