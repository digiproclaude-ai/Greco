import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Prose } from "@/components/marketplace/prose";
import { Badge } from "@/components/ui/badge";
import { countryName, languageName } from "@/lib/languages";
import { publicMediaUrl } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import type { ListingPage, ProviderPage } from "@/server/modules/marketplace/public";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-sm font-semibold text-ink-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Everything a moderator needs to judge a profile, shown as plain text (never as HTML). */
export async function ProfileReview({ page }: { page: ProviderPage }) {
  const [t, tProfile, locale] = await Promise.all([
    getTranslations("admin.moderation.fields"),
    getTranslations("marketplace.profile"),
    getLocale(),
  ]);
  return (
    <dl className="grid gap-5">
      <Field label={t("headline")}>{page.headline ?? "—"}</Field>
      <Field label={t("bio")}>
        <Prose text={page.bio} />
      </Field>
      <Field label={t("country")}>{countryName(page.countryCode, locale) ?? "—"}</Field>
      <Field label={t("experience")}>
        {page.experienceLevel ? tProfile(`experienceLevels.${page.experienceLevel}`) : "—"}
        {page.yearsExperience !== null ? ` · ${tProfile("years", { count: page.yearsExperience })}` : ""}
      </Field>
      <Field label={t("skills")}>
        <ul className="flex flex-wrap gap-1.5">
          {page.terms.map((term) => (
            <li key={term.id}>
              <Badge>{term.name}</Badge>
            </li>
          ))}
        </ul>
      </Field>
      <Field label={t("languages")}>
        {page.languages.map((l) => `${languageName(l.language_code, locale)} (${tProfile(`proficiency.${l.proficiency}`)})`).join(", ") || "—"}
      </Field>
      <Field label={t("links")}>
        <ul className="grid gap-1">
          {[...(page.websiteUrl ? [page.websiteUrl] : []), ...page.links.map((l) => l.url)].map((url) => (
            <li key={url} className="font-mono text-sm break-all">
              {url}
            </li>
          ))}
        </ul>
      </Field>
    </dl>
  );
}

export async function ListingReview({ page }: { page: ListingPage }) {
  const [t, tListing, tPublic, locale] = await Promise.all([
    getTranslations("admin.moderation.fields"),
    getTranslations("listing"),
    getTranslations("marketplace.listing"),
    getLocale(),
  ]);
  const percent = (bps: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(bps / 10000);
  const money = (minor: number | null) => (minor ? formatMoney(minor, page.currency, locale) : "—");
  return (
    <dl className="grid gap-5">
      <Field label={t("summary")}>{page.summary ?? "—"}</Field>
      <Field label={t("description")}>
        <Prose text={page.description} />
      </Field>
      <Field label={t("pricing")}>
        {`${tListing(`pricingModels.${page.pricingModel}.title`)} · ${page.currency}`}
        {page.pricingModel === "fixed" ? ` · ${money(page.fixedPriceMinor)}` : ""}
        {page.pricingModel === "hourly" ? ` · ${money(page.hourlyRateMinor)} × ${page.minHours ?? "—"}` : ""}
        {page.pricingModel === "quote" ? ` · ${money(page.quoteFromMinor)}` : ""}
      </Field>
      <Field label={t("payment")}>
        {page.paymentModel === "deposit" && page.depositBps
          ? `${tListing("paymentModels.deposit.title")} · ${percent(page.depositBps)} · ${page.balanceTrigger ? tListing(`balanceTriggers.${page.balanceTrigger}`) : ""}`
          : tListing("paymentModels.full.title")}
      </Field>
      {page.packages.length > 0 ? (
        <Field label={t("packages")}>
          <ul className="grid gap-1">
            {page.packages.map((pkg) => (
              <li key={pkg.id}>{`${pkg.name} · ${money(pkg.price_minor)} · ${tPublic("deliveryDays", { days: pkg.delivery_days })}${pkg.description ? ` · ${pkg.description}` : ""}`}</li>
            ))}
          </ul>
        </Field>
      ) : null}
      {page.deliverables.length > 0 ? (
        <Field label={t("deliverables")}>
          <ul className="list-disc ps-5">
            {page.deliverables.map((d) => (
              <li key={d.id}>{d.title}</li>
            ))}
          </ul>
        </Field>
      ) : null}
      {page.addons.length > 0 ? (
        <Field label={t("addons")}>
          <ul className="list-disc ps-5">
            {page.addons.map((a) => (
              <li key={a.id}>{`${a.title} · ${money(a.price_minor)}${a.description ? ` · ${a.description}` : ""}`}</li>
            ))}
          </ul>
        </Field>
      ) : null}
      {page.requirements.length > 0 ? (
        <Field label={t("requirements")}>
          <ul className="list-disc ps-5">
            {page.requirements.map((r) => (
              <li key={r.id}>{r.prompt}</li>
            ))}
          </ul>
        </Field>
      ) : null}
      {page.faqs.length > 0 ? (
        <Field label={t("faqs")}>
          <ul className="grid gap-2">
            {page.faqs.map((f) => (
              <li key={f.id}>
                <p className="font-medium">{f.question}</p>
                <p className="text-ink-muted whitespace-pre-line">{f.answer}</p>
              </li>
            ))}
          </ul>
        </Field>
      ) : null}
      {page.revisionPolicy ? (
        <Field label={t("revisionPolicy")}>
          <Prose text={page.revisionPolicy} />
        </Field>
      ) : null}
      {page.media.length > 0 ? (
        <Field label={t("images")}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {page.media.map((m) => (
              <li key={m.id} className="grid gap-1">
                {m.path ? (
                  <Image src={publicMediaUrl(m.path) ?? ""} alt={m.alt} width={320} height={200} className="aspect-[16/10] w-full rounded-md border border-line object-cover" unoptimized />
                ) : null}
                <span className="text-xs text-ink-muted">{m.alt}</span>
              </li>
            ))}
          </ul>
        </Field>
      ) : null}
    </dl>
  );
}
