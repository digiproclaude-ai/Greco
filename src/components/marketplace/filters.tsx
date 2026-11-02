import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { getPathname, Link } from "@/i18n/navigation";
import { LANGUAGE_CODES, languageName } from "@/lib/languages";
import { CURRENCIES } from "@/lib/money";
import { DELIVERY_OPTIONS, LISTING_SORTS, PROVIDER_SORTS, type ListingFilters, type ProviderFilters } from "@/server/modules/marketplace/search";

type Option = { value: string; label: string };

function Select({ name, label, value, options, anyLabel }: { name: string; label: string; value: string | null; options: Option[]; anyLabel?: string }) {
  const id = `filter-${name}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} name={name} defaultValue={value ?? ""}>
        {anyLabel !== undefined ? <option value="">{anyLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

/** Filters for service search and category pages. A plain GET form: works without JavaScript. */
export async function ListingFiltersForm({
  action,
  filters,
  categories,
  skills,
  showCategory = true,
}: {
  action: string;
  filters: ListingFilters;
  categories: Option[];
  skills: Option[];
  showCategory?: boolean;
}) {
  const [t, locale] = await Promise.all([getTranslations("marketplace.filters"), getLocale()]);
  return (
    <form action={getPathname({ href: action, locale })} method="get" className="grid gap-4" aria-label={t("title")}>
      {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
      <Select
        name="sort"
        label={t("sort")}
        value={filters.sort}
        options={LISTING_SORTS.map((value) => ({ value, label: t(`sorts.${value}`) }))}
      />
      {showCategory ? (
        <Select name="category" label={t("category")} value={filters.category} options={categories} anyLabel={t("anyCategory")} />
      ) : null}
      <Select name="skill" label={t("skill")} value={filters.skill} options={skills} anyLabel={t("anySkill")} />
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t("budget")}</legend>
        <div className="grid grid-cols-[5.5rem_1fr_1fr] gap-2">
          <NativeSelect name="currency" defaultValue={filters.currency} aria-label={t("currency")}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </NativeSelect>
          <Input name="min" inputMode="decimal" defaultValue={filters.min ?? ""} placeholder={t("min")} aria-label={t("min")} />
          <Input name="max" inputMode="decimal" defaultValue={filters.max ?? ""} placeholder={t("max")} aria-label={t("max")} />
        </div>
      </fieldset>
      <Select
        name="delivery"
        label={t("delivery")}
        value={filters.delivery ? String(filters.delivery) : null}
        options={DELIVERY_OPTIONS.map((days) => ({ value: String(days), label: t("deliveryWithin", { days }) }))}
        anyLabel={t("anyDelivery")}
      />
      <Select
        name="type"
        label={t("providerType")}
        value={filters.type}
        options={[
          { value: "individual", label: t("individual") },
          { value: "agency", label: t("agency") },
        ]}
        anyLabel={t("anyType")}
      />
      <Select
        name="language"
        label={t("language")}
        value={filters.language}
        options={LANGUAGE_CODES.map((code) => ({ value: code, label: languageName(code, locale) })).sort((a, b) =>
          a.label.localeCompare(b.label, locale),
        )}
        anyLabel={t("anyLanguage")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">{t("apply")}</Button>
        <Link href={filters.q ? `${action}?q=${encodeURIComponent(filters.q)}` : action} className="text-sm text-accent hover:underline">
          {t("clear")}
        </Link>
      </div>
    </form>
  );
}

export async function ProviderFiltersForm({
  filters,
  categories,
  skills,
}: {
  filters: ProviderFilters;
  categories: Option[];
  skills: Option[];
}) {
  const [t, locale] = await Promise.all([getTranslations("marketplace.filters"), getLocale()]);
  return (
    <form action={getPathname({ href: "/experts", locale })} method="get" className="grid gap-4" aria-label={t("title")}>
      {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
      <Select
        name="sort"
        label={t("sort")}
        value={filters.sort}
        options={PROVIDER_SORTS.map((value) => ({ value, label: t(`sorts.${value}`) }))}
      />
      <Select name="category" label={t("category")} value={filters.category} options={categories} anyLabel={t("anyCategory")} />
      <Select name="skill" label={t("skill")} value={filters.skill} options={skills} anyLabel={t("anySkill")} />
      <Select
        name="type"
        label={t("providerType")}
        value={filters.type}
        options={[
          { value: "individual", label: t("individual") },
          { value: "agency", label: t("agency") },
        ]}
        anyLabel={t("anyType")}
      />
      <Select
        name="language"
        label={t("language")}
        value={filters.language}
        options={LANGUAGE_CODES.map((code) => ({ value: code, label: languageName(code, locale) })).sort((a, b) =>
          a.label.localeCompare(b.label, locale),
        )}
        anyLabel={t("anyLanguage")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">{t("apply")}</Button>
        <Link href={filters.q ? `/experts?q=${encodeURIComponent(filters.q)}` : "/experts"} className="text-sm text-accent hover:underline">
          {t("clear")}
        </Link>
      </div>
    </form>
  );
}
