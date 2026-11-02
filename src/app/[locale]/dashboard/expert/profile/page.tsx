import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import {
  AgencyForm,
  AvatarForm,
  BasicsForm,
  HandleForm,
  LanguagesForm,
  LinksForm,
  SkillsForm,
  SubmitProfileForm,
} from "@/components/expert/profile-forms";
import { ChecklistList, ProviderStatusPanel } from "@/components/expert/status-panel";
import { EditorSection } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getPublicEnv } from "@/lib/env";
import { LANGUAGE_CODES, languageName, timeZones } from "@/lib/languages";
import { publicMediaUrl } from "@/lib/media";
import { CURRENCIES } from "@/lib/money";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { MAX_PROVIDER_TERMS, TEAM_SIZES } from "@/server/modules/providers/schemas";
import { getProviderEditor } from "@/server/modules/providers/service";
import { countryOptions } from "@/server/modules/reference/countries";
import { getActiveTerms } from "@/server/modules/taxonomy/service";

const CHECKLIST = ["headline", "bio", "country", "experience", "skills", "languages"] as const;
const PROFILE_TERM_KINDS = new Set(["skill", "technology", "tool", "framework", "model", "platform", "use_case"]);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expert.profile");
  return { title: t("title") };
}

export default async function ExpertProfilePage() {
  const account = await requireRole("expert", "/dashboard/expert/profile");
  const session = await getSessionClaims();
  const [t, tKinds, locale] = await Promise.all([
    getTranslations("expert.profile"),
    getTranslations("expert.termKinds"),
    getLocale(),
  ]);
  if (!session || !account.provider) return null;

  const [data, terms, countries] = await Promise.all([
    getProviderEditor(session.supabase, account.provider.id),
    getActiveTerms(locale),
    countryOptions(locale, "sell"),
  ]);
  if (!data) return null;
  const { provider } = data;

  const checklistLabels = Object.fromEntries(CHECKLIST.map((key) => [key, t(`checklist.${key}`)]));
  const missing = data.missing.map((key) => checklistLabels[key] ?? key);
  const kindLabels = Object.fromEntries(
    (["skill", "technology", "tool", "framework", "model", "platform", "industry", "use_case"] as const).map((kind) => [
      kind,
      tKinds(kind),
    ]),
  );
  const canSubmit = provider.status === "draft" && data.missing.length === 0;

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
          <p className="text-ink-muted">{t("intro")}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/experts/${provider.handle}`}>{t("viewPublic")}</Link>
        </Button>
      </div>

      <EditorSection id="status" title={t("sections.status")}>
        <ProviderStatusPanel status={provider.status} lastDecision={data.lastDecision} />
        {provider.status === "draft" ? (
          <>
            <ChecklistList title={t("checklist.title")} doneLabel={t("checklist.done")} items={missing} />
            <SubmitProfileForm checklistLabels={checklistLabels} disabled={!canSubmit} />
          </>
        ) : null}
      </EditorSection>

      <EditorSection id="address" title={t("sections.address")} description={t("sections.addressDescription")}>
        <HandleForm handle={provider.handle} baseUrl={getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, "")} />
      </EditorSection>

      <EditorSection id="photo" title={t("sections.photo")} description={t("sections.photoDescription")}>
        <AvatarForm avatarUrl={publicMediaUrl(data.avatarPath)} name={provider.display_name} />
      </EditorSection>

      <EditorSection id="basics" title={t("sections.basics")} description={t("sections.basicsDescription")}>
        <BasicsForm
          profile={{
            providerType: provider.provider_type,
            displayName: provider.display_name,
            headline: provider.headline,
            bio: provider.bio,
            country: provider.country_code,
            city: provider.city,
            timezone: provider.timezone,
            experienceLevel: provider.experience_level,
            yearsExperience: provider.years_experience,
            availability: provider.availability,
            availabilityNote: provider.availability_note,
            rateMinor: provider.indicative_hourly_rate_minor,
            rateCurrency: provider.rate_currency,
            website: provider.website_url,
          }}
          countries={countries}
          timeZones={timeZones()}
          currencies={CURRENCIES}
        />
      </EditorSection>

      {provider.provider_type === "agency" ? (
        <EditorSection id="agency" title={t("sections.agency")} description={t("sections.agencyDescription")}>
          <AgencyForm
            teamSizes={TEAM_SIZES}
            agency={{
              foundedYear: data.agency?.founded_year ?? null,
              teamSize: data.agency?.team_size_range ?? null,
              offices: data.agency?.office_locations ?? [],
              legalName: data.agency?.legal_name ?? null,
              registrationNumber: data.agency?.registration_number ?? null,
            }}
          />
        </EditorSection>
      ) : null}

      <EditorSection id="skills" title={t("sections.skills")} description={t("sections.skillsDescription")}>
        <SkillsForm
          terms={terms.filter((term) => PROFILE_TERM_KINDS.has(term.kind) || data.termIds.includes(term.id))}
          selected={data.termIds}
          max={MAX_PROVIDER_TERMS}
          kindLabels={kindLabels}
        />
      </EditorSection>

      <EditorSection id="languages" title={t("sections.languages")} description={t("sections.languagesDescription")}>
        <LanguagesForm
          languages={data.languages.map((row) => ({
            code: row.language_code,
            name: languageName(row.language_code, locale),
            proficiency: row.proficiency,
          }))}
          languageOptions={LANGUAGE_CODES.filter((code) => !data.languages.some((row) => row.language_code === code))
            .map((code) => ({ value: code, label: languageName(code, locale) }))
            .sort((a, b) => a.label.localeCompare(b.label, locale))}
        />
      </EditorSection>

      <EditorSection id="links" title={t("sections.links")} description={t("sections.linksDescription")}>
        <LinksForm links={data.links} />
      </EditorSection>
    </div>
  );
}
