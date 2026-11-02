import { Building2, ExternalLink, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Avatar } from "@/components/marketplace/avatar";
import { CardGrid, ListingCard } from "@/components/marketplace/cards";
import { Prose } from "@/components/marketplace/prose";
import { ResultsSkeleton } from "@/components/marketplace/results-skeleton";
import { SaveButton } from "@/components/marketplace/save-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { countryName, languageName } from "@/lib/languages";
import { publicMediaUrl } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import { getSessionClaims } from "@/server/auth/session";
import { getPublicProviderPage, loadProviderPage, type ProviderPage } from "@/server/modules/marketplace/public";
import { emptyListingFilters, searchListings } from "@/server/modules/marketplace/search";

type Props = PageProps<"/[locale]/experts/[handle]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ handle }, locale] = await Promise.all([params, getLocale()]);
  const page = await getPublicProviderPage(handle, locale);
  if (!page) return { robots: { index: false } };
  return {
    title: page.displayName,
    description: page.headline ?? undefined,
    alternates: { canonical: `/experts/${page.handle}` },
  };
}

export default function ExpertProfilePage({ params }: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Suspense fallback={<ResultsSkeleton count={3} />}>
        <Profile params={params} />
      </Suspense>
    </div>
  );
}

/** Public page for active experts; owners and staff also see drafts, marked as a preview. */
async function resolve(handle: string, locale: string): Promise<{ page: ProviderPage; preview: boolean } | null> {
  const page = await getPublicProviderPage(handle, locale);
  if (page) return { page, preview: false };
  const session = await getSessionClaims();
  if (!session) return null;
  const { page: own } = await loadProviderPage(session.supabase, handle, locale);
  return own ? { page: own, preview: true } : null;
}

async function Profile({ params }: Pick<Props, "params">) {
  const [{ handle }, locale] = await Promise.all([params, getLocale()]);
  const resolved = await resolve(handle, locale);
  if (!resolved) notFound();
  const { page, preview } = resolved;
  const [t, format] = await Promise.all([getTranslations("marketplace.profile"), getFormatter()]);
  const listings = preview
    ? { items: [], total: 0 }
    : await searchListings({ ...emptyListingFilters(), providerId: page.id, limit: 24 });
  const country = countryName(page.countryCode, locale);

  return (
    <div className="grid gap-8">
      {preview ? <Alert variant="warning">{t("preview")}</Alert> : null}
      <header className="flex flex-wrap items-start gap-5">
        <Avatar path={page.avatarPath} name={page.displayName} size={96} />
        <div className="grid min-w-0 flex-1 gap-2">
          <h1 className="font-display text-3xl font-semibold">{page.displayName}</h1>
          {page.headline ? <p className="text-lg text-ink-muted">{page.headline}</p> : null}
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            {page.providerType === "agency" ? (
              <Badge>
                <Building2 className="size-3" aria-hidden="true" />
                {t("agencyDetails")}
              </Badge>
            ) : null}
            {country ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" />
                {page.city ? `${page.city}, ${country}` : country}
              </span>
            ) : null}
            <Badge variant={page.availability === "available" ? "success" : "neutral"}>
              {t(`availabilityStatus.${page.availability}`)}
            </Badge>
          </div>
        </div>
        {preview ? null : (
          <Suspense>
            <SaveButton kind="provider" id={page.id} returnTo={`/experts/${page.handle}`} />
          </Suspense>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="grid min-w-0 content-start gap-10">
          {page.bio ? (
            <section aria-labelledby="about" className="grid gap-3">
              <h2 id="about" className="font-display text-xl font-semibold">
                {t("about")}
              </h2>
              <Prose text={page.bio} />
            </section>
          ) : null}

          <section aria-labelledby="services" className="grid gap-4">
            <h2 id="services" className="font-display text-xl font-semibold">
              {t("services")}
            </h2>
            {listings.items.length === 0 ? (
              <p className="text-ink-muted">{t("noServices")}</p>
            ) : (
              <CardGrid>
                {listings.items.map((item) => (
                  <ListingCard key={item.listing_id} item={item} />
                ))}
              </CardGrid>
            )}
          </section>

          {page.portfolio.length > 0 ? (
            <section aria-labelledby="portfolio" className="grid gap-4">
              <h2 id="portfolio" className="font-display text-xl font-semibold">
                {t("portfolio")}
              </h2>
              <ul className="grid gap-5">
                {page.portfolio.map((item) => {
                  const cover = publicMediaUrl(item.media[0]?.path);
                  return (
                    <li key={item.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                      {cover ? (
                        <Image
                          src={cover}
                          alt={item.media[0]?.caption ?? ""}
                          width={960}
                          height={540}
                          className="aspect-[16/9] w-full bg-paper object-cover"
                          unoptimized
                        />
                      ) : null}
                      <div className="grid gap-3 p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{item.title}</h3>
                          <Badge variant={item.provenance === "self_reported" ? "neutral" : "success"}>
                            {item.provenance === "self_reported" ? t("selfReportedBadge") : t("verifiedBadge")}
                          </Badge>
                        </div>
                        <p className="text-sm text-ink-muted">
                          {[
                            item.role ? t("role", { role: item.role }) : null,
                            item.clientName ? t("client", { name: item.clientName }) : null,
                            item.projectDate ? format.dateTime(new Date(item.projectDate), { year: "numeric", month: "long" }) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {item.summary ? <p>{item.summary}</p> : null}
                        {item.problem || item.solution || item.results ? (
                          <details className="group">
                            <summary className="cursor-pointer text-sm font-medium text-accent">{t("readMore")}</summary>
                            <div className="mt-3 grid gap-4">
                              {item.problem ? (
                                <div className="grid gap-1">
                                  <h4 className="text-sm font-semibold">{t("problem")}</h4>
                                  <Prose text={item.problem} />
                                </div>
                              ) : null}
                              {item.solution ? (
                                <div className="grid gap-1">
                                  <h4 className="text-sm font-semibold">{t("solution")}</h4>
                                  <Prose text={item.solution} />
                                </div>
                              ) : null}
                              {item.results ? (
                                <div className="grid gap-1">
                                  <h4 className="text-sm font-semibold">{t("results")}</h4>
                                  <Prose text={item.results} />
                                </div>
                              ) : null}
                            </div>
                          </details>
                        ) : null}
                        {item.terms.length > 0 ? (
                          <ul className="flex flex-wrap gap-1.5">
                            {item.terms.map((term) => (
                              <li key={term.id}>
                                <Badge>{term.name}</Badge>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {item.externalUrl ? (
                          <a
                            href={item.externalUrl}
                            rel="nofollow ugc noopener noreferrer"
                            target="_blank"
                            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                          >
                            {t("viewWork")}
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          <section aria-labelledby="contact" className="grid gap-2 rounded-lg border border-line bg-surface p-5">
            <h2 id="contact" className="font-semibold">
              {t("contact")}
            </h2>
            <Button disabled>{t("contact")}</Button>
            <p className="text-sm text-ink-muted">{t("contactSoon")}</p>
          </section>

          <section aria-labelledby="details" className="grid gap-3 rounded-lg border border-line bg-surface p-5 text-[15px]">
            <h2 id="details" className="font-semibold">
              {t("details")}
            </h2>
            <dl className="grid gap-2">
              {page.experienceLevel ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{t("experience")}</dt>
                  <dd className="text-end">
                    {t(`experienceLevels.${page.experienceLevel}`)}
                    {page.yearsExperience !== null ? ` · ${t("years", { count: page.yearsExperience })}` : ""}
                  </dd>
                </div>
              ) : null}
              {page.rateMinor && page.rateCurrency ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{t("rate")}</dt>
                  <dd>{t("rateValue", { price: formatMoney(page.rateMinor, page.rateCurrency, locale, { trimZeroFraction: true }) })}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">{t("timezone")}</dt>
                <dd className="text-end">{page.timezone.replaceAll("_", " ")}</dd>
              </div>
              {page.availabilityNote ? (
                <div className="grid gap-0.5">
                  <dt className="text-ink-muted">{t("availability")}</dt>
                  <dd>{page.availabilityNote}</dd>
                </div>
              ) : null}
              {page.publishedAt ? (
                <div className="text-sm text-ink-muted">{t("memberSince", { date: format.dateTime(new Date(page.publishedAt), { year: "numeric", month: "long" }) })}</div>
              ) : null}
            </dl>
          </section>

          {page.agency ? (
            <section aria-labelledby="agency" className="grid gap-2 rounded-lg border border-line bg-surface p-5 text-[15px]">
              <h2 id="agency" className="font-semibold">
                {t("agencyDetails")}
              </h2>
              {page.agency.foundedYear ? <p>{t("founded", { year: String(page.agency.foundedYear) })}</p> : null}
              {page.agency.teamSize ? <p>{t("teamSize", { size: page.agency.teamSize })}</p> : null}
              {page.agency.offices.length > 0 ? <p className="text-ink-muted">{`${t("offices")}: ${page.agency.offices.join(", ")}`}</p> : null}
            </section>
          ) : null}

          {page.terms.length > 0 ? (
            <section aria-labelledby="skills" className="grid gap-3 rounded-lg border border-line bg-surface p-5">
              <h2 id="skills" className="font-semibold">
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

          {page.languages.length > 0 ? (
            <section aria-labelledby="languages" className="grid gap-2 rounded-lg border border-line bg-surface p-5 text-[15px]">
              <h2 id="languages" className="font-semibold">
                {t("languages")}
              </h2>
              <ul className="grid gap-1">
                {page.languages.map((language) => (
                  <li key={language.language_code} className="flex justify-between gap-3">
                    <span>{languageName(language.language_code, locale)}</span>
                    <span className="text-ink-muted">{t(`proficiency.${language.proficiency}`)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {page.links.length > 0 || page.websiteUrl ? (
            <section aria-labelledby="links" className="grid gap-2 rounded-lg border border-line bg-surface p-5 text-[15px]">
              <h2 id="links" className="font-semibold">
                {t("links")}
              </h2>
              <ul className="grid gap-1">
                {[...(page.websiteUrl ? [{ kind: "website", url: page.websiteUrl }] : []), ...page.links].map((link) => (
                  <li key={link.url}>
                    <a href={link.url} rel="nofollow ugc noopener noreferrer" target="_blank" className="break-all text-accent hover:underline">
                      {link.url.replace(/^https:\/\//, "")}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-subtle">{t("linksNote")}</p>
            </section>
          ) : null}

          <p className="text-xs text-ink-subtle">{t("selfReported")}</p>
        </aside>
      </div>
    </div>
  );
}
