import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  const t = await getTranslations("marketplace.categories");
  return (
    <nav aria-label={t("breadcrumb")} className="text-sm text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-accent">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
