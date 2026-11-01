import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations();
  return (
    <main id="main" className="mx-auto grid max-w-xl flex-1 content-center gap-4 px-4 py-20">
      <h1 className="font-display text-4xl font-semibold">{t("errors.notFound.title")}</h1>
      <p className="text-lg text-ink-muted">{t("errors.notFound.body")}</p>
      <div>
        <Button asChild>
          <Link href="/">{t("common.actions.goHome")}</Link>
        </Button>
      </div>
    </main>
  );
}
