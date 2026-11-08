import { Check, Clock, RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Avatar } from "@/components/marketplace/avatar";
import { Breadcrumbs } from "@/components/marketplace/breadcrumbs";
import { Prose } from "@/components/marketplace/prose";
import { ResultsSkeleton } from "@/components/marketplace/results-skeleton";
import { SaveButton } from "@/components/marketplace/save-button";
import { ContactButton } from "@/components/messages/contact-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { publicMediaUrl } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import { getSessionClaims } from "@/server/auth/session";
import { contactExpertAction } from "@/server/modules/messaging/actions";
import { getPublicListingPage, listingPriceFrom, loadListingPage, type ListingPage } from "@/server/modules/marketplace/public";
import { categoryAncestors, getCategories } from "@/server/modules/taxonomy/service";

type Props = PageProps<"/[locale]/experts/[handle]/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ handle, slug }, locale] = await Promise.all([params, getLocale()]);
  const page = await getPublicListingPage(handle, slug, locale);
  if (!page) return { robots: { index: false } };
  return {
    title: page.title,
    description: page.summary ?? undefined,
    alternates: { canonical: `/experts/${page.provider.handle}/${page.slug}` },
  };
}

export default function ServicePage({ params }: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Suspense fallback={<ResultsSkeleton count={3} />}>
        <Service params={params} />
      </Suspense>
    </div>
  );
}

async function resolve(handle: string, slug: string, locale: string): Promise<{ page: ListingPage; preview: boolean } | null> {
  const page = await getPublicListingPage(handle, slug, locale);
  if (page) return { page, preview: false };
  const session = await getSessionClaims();
  if (!session) return null;
  const { page: own } = await loadListingPage(session.supabase, handle, slug, locale);
  return own ? { page: own, preview: true } : null;
}

async function Service({ params }: Pick<Props, "params">) {
  const [{ handle, slug }, locale] = await Promise.all([params, getLocale()]);
  const resolved = await resolve(handle, slug, locale);
  if (!resolved) notFound();
  const { page, preview } = resolved;
  const [t, tCategories, categories] = await Promise.all([
    getTranslations("marketplace.listing"),
    getTranslations("marketplace.categories"),
    getCategories(locale),
  ]);

  const money = (minor: number) => formatMoney(minor, page.currency, locale, { trimZeroFraction: true });
  const percent = (bps: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(bps / 10000);
  const category = categories.find((c) => c.id === page.primaryCategoryId);
  const crumbs = category ? [...categoryAncestors(categories, category), category] : [];
  const priceFrom = listingPriceFrom(page);
  const sharedDeliverables = page.deliverables.filter((d) => !d.package_id);
  const cover = page.media[0];
  const gallery = page.media.slice(1);
  const publicPath = `/experts/${page.provider.handle}/${page.slug}`;

  const priceSummary =
    page.pricingModel === "hourly" && page.hourlyRateMinor && page.minHours
      ? t("hourly", { rate: money(page.hourlyRateMinor), hours: page.minHours })
      : page.pricingModel === "quote"
        ? page.quoteFromMinor
          ? t("quoteFrom", { price: money(page.quoteFromMinor) })
          : t("quote")
        : priceFrom
          ? money(priceFrom)
          : null;
  const delivery =
    page.pricingModel === "packages" ? Math.min(...page.packages.map((pkg) => pkg.delivery_days)) : page.baseDeliveryDays;

  return (
    <div className="grid gap-8">
      {preview ? <Alert variant="warning">{t("preview")}</Alert> : null}
      <div className="grid gap-4">
        <Breadcrumbs
          items={[
            { label: tCategories("home"), href: "/" },
            ...crumbs.map((c) => ({ label: c.name, href: `/categories/${c.urlPath}` })),
            { label: page.title },
          ]}
        />
        <h1 className="max-w-[30ch] font-display text-3xl font-semibold sm:text-4xl">{page.title}</h1>
        <Link href={`/experts/${page.provider.handle}`} className="flex w-fit items-center gap-2 text-[15px] hover:text-accent">
          <Avatar path={page.provider.avatarPath} name={page.provider.displayName} size={32} />
          <span className="font-medium">{page.provider.displayName}</span>
          {page.provider.headline ? <span className="hidden text-ink-muted sm:inline">{`· ${page.provider.headline}`}</span> : null}
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-10">
          {cover?.path ? (
            <figure className="grid gap-3">
              <Image
                src={publicMediaUrl(cover.path) ?? ""}
                alt={cover.alt}
                width={1280}
                height={800}
                className="aspect-[16/10] w-full rounded-lg border border-line bg-paper object-cover"
                unoptimized
                priority
              />
              {gallery.length > 0 ? (
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label={t("gallery")}>
                  {gallery.map((image) => (
                    <li key={image.id}>
                      <a href={publicMediaUrl(image.path) ?? "#"} target="_blank" rel="noopener noreferrer">
                        <Image
                          src={publicMediaUrl(image.path) ?? ""}
                          alt={image.alt}
                          width={320}
                          height={200}
                          className="aspect-[16/10] w-full rounded-md border border-line bg-paper object-cover"
                          unoptimized
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </figure>
          ) : null}

          <section aria-labelledby="about" className="grid gap-3">
            <h2 id="about" className="font-display text-xl font-semibold">
              {t("about")}
            </h2>
            {page.summary ? <p className="text-lg text-ink-muted">{page.summary}</p> : null}
            <Prose text={page.description} />
          </section>

          {page.pricingModel === "packages" && page.packages.length > 0 ? (
            <section aria-labelledby="packages" className="grid gap-3">
              <h2 id="packages" className="font-display text-xl font-semibold">
                {t("packages")}
              </h2>
              <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="w-full min-w-[32rem] text-[15px]">
                  <caption className="sr-only">{t("compare")}</caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="p-4 text-start font-medium text-ink-muted">
                        <span className="sr-only">{t("packages")}</span>
                      </th>
                      {page.packages.map((pkg) => (
                        <th key={pkg.id} scope="col" className="p-4 text-start align-top">
                          <span className="block font-semibold">{pkg.name}</span>
                          {pkg.description ? <span className="mt-1 block text-sm font-normal text-ink-muted">{pkg.description}</span> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    <tr>
                      <th scope="row" className="p-4 text-start font-medium text-ink-muted">
                        {t("price")}
                      </th>
                      {page.packages.map((pkg) => (
                        <td key={pkg.id} className="p-4 font-semibold">
                          {money(pkg.price_minor)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row" className="p-4 text-start font-medium text-ink-muted">
                        {t("delivery")}
                      </th>
                      {page.packages.map((pkg) => (
                        <td key={pkg.id} className="p-4">
                          {t("deliveryDays", { days: pkg.delivery_days })}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row" className="p-4 text-start font-medium text-ink-muted">
                        {t("revisions")}
                      </th>
                      {page.packages.map((pkg) => (
                        <td key={pkg.id} className="p-4">
                          {t("revisionsCount", { count: pkg.revisions_included })}
                        </td>
                      ))}
                    </tr>
                    {page.deliverables.length > 0 ? (
                      <tr>
                        <th scope="row" className="p-4 text-start align-top font-medium text-ink-muted">
                          {t("included")}
                        </th>
                        {page.packages.map((pkg) => (
                          <td key={pkg.id} className="p-4 align-top">
                            <ul className="grid gap-1.5">
                              {page.deliverables
                                .filter((d) => !d.package_id || d.package_id === pkg.id)
                                .map((d) => (
                                  <li key={d.id} className="flex gap-2 text-sm">
                                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                                    {d.title}
                                  </li>
                                ))}
                            </ul>
                          </td>
                        ))}
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : sharedDeliverables.length > 0 ? (
            <section aria-labelledby="included" className="grid gap-3">
              <h2 id="included" className="font-display text-xl font-semibold">
                {t("included")}
              </h2>
              <ul className="grid gap-2">
                {sharedDeliverables.map((d) => (
                  <li key={d.id} className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" />
                    {d.title}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {page.addons.length > 0 ? (
            <section aria-labelledby="addons" className="grid gap-3">
              <h2 id="addons" className="font-display text-xl font-semibold">
                {t("addons")}
              </h2>
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {page.addons.map((addon) => (
                  <li key={addon.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="grid gap-0.5">
                      <span className="font-medium">{addon.title}</span>
                      {addon.description ? <span className="text-sm text-ink-muted">{addon.description}</span> : null}
                    </div>
                    <span className="text-end text-sm">
                      <span className="block font-semibold">{t("addonPrice", { price: money(addon.price_minor) })}</span>
                      {addon.extra_delivery_days > 0 ? (
                        <span className="text-ink-muted">{t("addonDays", { days: addon.extra_delivery_days })}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {page.requirements.length > 0 ? (
            <section aria-labelledby="requirements" className="grid gap-3">
              <h2 id="requirements" className="font-display text-xl font-semibold">
                {t("requirements")}
              </h2>
              <ol className="grid list-decimal gap-1.5 ps-5">
                {page.requirements.map((r) => (
                  <li key={r.id}>{r.prompt}</li>
                ))}
              </ol>
            </section>
          ) : null}

          {page.faqs.length > 0 ? (
            <section aria-labelledby="faqs" className="grid gap-3">
              <h2 id="faqs" className="font-display text-xl font-semibold">
                {t("faqs")}
              </h2>
              <div className="divide-y divide-line rounded-lg border border-line bg-surface">
                {page.faqs.map((faq) => (
                  <details key={faq.id} className="group p-4">
                    <summary className="cursor-pointer font-medium">{faq.question}</summary>
                    <Prose text={faq.answer} className="mt-2 grid gap-2 text-ink-muted" />
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          {page.revisionPolicy ? (
            <section aria-labelledby="revision-policy" className="grid gap-2">
              <h2 id="revision-policy" className="font-display text-xl font-semibold">
                {t("revisionPolicy")}
              </h2>
              <Prose text={page.revisionPolicy} />
            </section>
          ) : null}

          {page.terms.length > 0 ? (
            <section aria-labelledby="skills" className="grid gap-3">
              <h2 id="skills" className="font-display text-xl font-semibold">
                {t("skills")}
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {page.terms.map((term) => (
                  <li key={term.id}>
                    <Badge>{term.name}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="grid content-start gap-5 lg:sticky lg:top-6 lg:self-start">
          <section aria-labelledby="price" className="grid gap-4 rounded-lg border border-line bg-surface p-5">
            <h2 id="price" className="sr-only">
              {t("price")}
            </h2>
            {priceSummary ? <p className="font-display text-2xl font-semibold">{priceSummary}</p> : null}
            <ul className="grid gap-2 text-[15px]">
              {delivery ? (
                <li className="flex items-center gap-2">
                  <Clock className="size-4 text-ink-muted" aria-hidden="true" />
                  {t("deliveryDays", { days: delivery })}
                </li>
              ) : null}
              {page.pricingModel !== "packages" && page.revisionsIncluded !== null ? (
                <li className="flex items-center gap-2">
                  <RefreshCw className="size-4 text-ink-muted" aria-hidden="true" />
                  {t("revisionsCount", { count: page.revisionsIncluded })}
                </li>
              ) : null}
            </ul>
            <div className="grid gap-1 rounded-md bg-paper p-3 text-sm">
              <p className="font-medium">{t("paymentTerms")}</p>
              <p className="text-ink-muted">
                {page.paymentModel === "deposit" && page.depositBps && page.balanceTrigger
                  ? t("paymentDeposit", { percent: percent(page.depositBps), trigger: t(`triggers.${page.balanceTrigger}`) })
                  : t("paymentFull")}
              </p>
              <p className="text-ink-muted">{t("noClientFee")}</p>
            </div>
            <Button disabled size="lg">
              {t("order")}
            </Button>
            <p className="text-sm text-ink-muted">{t("orderSoon")}</p>
            {preview ? null : (
              <div className="flex flex-wrap gap-2">
                <ContactButton
                  action={contactExpertAction.bind(null, { providerId: page.provider.id, listingId: page.id, returnTo: publicPath })}
                  label={t("contact")}
                />
                <Suspense>
                  <SaveButton kind="listing" id={page.id} returnTo={publicPath} />
                </Suspense>
              </div>
            )}
          </section>

          <section aria-labelledby="expert" className="grid gap-3 rounded-lg border border-line bg-surface p-5">
            <h2 id="expert" className="font-semibold">
              {t("aboutExpert")}
            </h2>
            <div className="flex items-center gap-3">
              <Avatar path={page.provider.avatarPath} name={page.provider.displayName} size={48} />
              <div className="grid min-w-0">
                <span className="truncate font-medium">{page.provider.displayName}</span>
                {page.provider.headline ? <span className="line-clamp-2 text-sm text-ink-muted">{page.provider.headline}</span> : null}
              </div>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/experts/${page.provider.handle}`}>{t("viewProfile")}</Link>
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
