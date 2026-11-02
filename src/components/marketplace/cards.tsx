import { Building2, Clock } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { publicMediaUrl } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import type { ListingCardData, ProviderCardData } from "@/server/modules/marketplace/search";

import { Avatar } from "./avatar";

export async function ListingCard({ item }: { item: ListingCardData }) {
  const [t, locale] = await Promise.all([getTranslations("marketplace.card"), getLocale()]);
  const cover = publicMediaUrl(item.cover_path);
  const price = item.price_from_minor ? formatMoney(item.price_from_minor, item.currency, locale, { trimZeroFraction: true }) : null;
  const priceLabel =
    item.pricing_model === "quote"
      ? price
        ? t("quoteFrom", { price })
        : t("quote")
      : price
        ? t("from", { price })
        : null;
  const href = `/experts/${item.provider_handle}/${item.slug}`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-accent">
      <div className="aspect-[16/10] bg-paper">
        {cover ? (
          <Image src={cover} alt="" width={480} height={300} className="size-full object-cover" unoptimized />
        ) : (
          <div aria-hidden="true" className="size-full bg-gradient-to-br from-accent-tint to-paper" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Avatar path={item.avatar_path} name={item.provider_name} size={24} />
          <span className="truncate">{item.provider_name}</span>
          {item.provider_type === "agency" ? (
            <Badge>
              <Building2 className="size-3" aria-hidden="true" />
              {t("agency")}
            </Badge>
          ) : null}
        </div>
        <h3 className="font-semibold leading-snug">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {item.title}
          </Link>
        </h3>
        {item.summary ? <p className="line-clamp-2 text-sm text-ink-muted">{item.summary}</p> : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 text-sm">
          {priceLabel ? <span className="font-semibold">{priceLabel}</span> : <span />}
          {item.delivery_days_min ? (
            <span className="inline-flex items-center gap-1 text-ink-muted">
              <Clock className="size-3.5" aria-hidden="true" />
              {t("delivery", { days: item.delivery_days_min })}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export async function ProviderCard({ item }: { item: ProviderCardData }) {
  const [t, tProfile, locale] = await Promise.all([
    getTranslations("marketplace.card"),
    getTranslations("marketplace.profile"),
    getLocale(),
  ]);
  const country = item.country_code ? new Intl.DisplayNames([locale], { type: "region" }).of(item.country_code) : null;
  return (
    <article className="relative flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 transition-colors hover:border-accent">
      <div className="flex items-center gap-3">
        <Avatar path={item.avatar_path} name={item.display_name} size={48} />
        <div className="grid min-w-0">
          <h3 className="truncate font-semibold">
            <Link href={`/experts/${item.handle}`} className="after:absolute after:inset-0 focus-visible:outline-none">
              {item.display_name}
            </Link>
          </h3>
          <p className="truncate text-sm text-ink-muted">
            {[item.provider_type === "agency" ? t("agency") : null, country].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {item.headline ? <p className="line-clamp-2 text-[15px]">{item.headline}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        {item.experience_level ? <Badge>{tProfile(`experienceLevels.${item.experience_level}`)}</Badge> : null}
        <span>{t("services", { count: Number(item.listing_count) })}</span>
        {item.price_from_minor && item.currency ? (
          <span>{`· ${t("rateFrom", { price: formatMoney(item.price_from_minor, item.currency, locale, { trimZeroFraction: true }) })}`}</span>
        ) : null}
      </div>
    </article>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
