import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function Pagination({
  page,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const t = await getTranslations("marketplace.pagination");
  return (
    <nav aria-label={t("label")} className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={hrefFor(page - 1)} rel="prev">
            {t("previous")}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="text-sm text-ink-muted">{t("page", { page, total: pages })}</span>
      {page < pages ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={hrefFor(page + 1)} rel="next">
            {t("next")}
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
