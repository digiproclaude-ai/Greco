"use client";

import { Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { SubmitButton as PendingButton } from "@/components/auth/form-parts";
import { FormActions, FormStatus, SelectField, TextAreaField, TextField, type Option } from "@/components/forms/fields";
import { TermPicker, type PickerTerm } from "@/components/forms/term-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { minorToDecimalString } from "@/lib/money";
import {
  addLanguageAction,
  addLinkAction,
  removeAvatarAction,
  removeLanguageAction,
  removeLinkAction,
  saveAgencyAction,
  saveProfileAction,
  saveTermsAction,
  setHandleAction,
  submitProfileAction,
  suggestTermAction,
  uploadAvatarAction,
} from "@/server/modules/providers/actions";
import { idleState } from "@/server/modules/shared/action-state";

export function HandleForm({ handle, baseUrl }: { handle: string; baseUrl: string }) {
  const t = useTranslations("expert.profile.fields");
  const tForms = useTranslations("forms");
  const [state, action] = useActionState(setHandleAction, idleState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormStatus state={state} />
      <div className="grid gap-1.5">
        <TextField
          name="handle"
          label={t("handle")}
          hint={t("handleHint")}
          state={state}
          defaultValue={handle}
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          required
        />
        <p className="font-mono text-sm text-ink-muted">{`${baseUrl}/experts/${handle}`}</p>
      </div>
      <FormActions>
        <PendingButton>{tForms("save")}</PendingButton>
      </FormActions>
    </form>
  );
}

export function AvatarForm({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  const t = useTranslations("expert.profile.fields");
  const tForms = useTranslations("forms");
  const [state, action] = useActionState(uploadAvatarAction, idleState);
  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-paper font-display text-3xl text-ink-muted">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={96} height={96} className="size-24 object-cover" unoptimized />
        ) : (
          <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="grid flex-1 gap-3">
        <form action={action} className="grid gap-3">
          <FormStatus state={state} />
          <div className="grid gap-1.5">
            <Label htmlFor="field-avatar">{t("avatar")}</Label>
            <Input id="field-avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" required className="py-1.5" />
          </div>
          <FormActions>
            <PendingButton>{tForms("upload")}</PendingButton>
          </FormActions>
        </form>
        {avatarUrl ? (
          <form action={removeAvatarAction}>
            <Button type="submit" variant="ghost" size="sm">
              <Trash2 aria-hidden="true" />
              {t("removeAvatar")}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export type ProfileBasics = {
  providerType: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  timezone: string;
  experienceLevel: string | null;
  yearsExperience: number | null;
  availability: string;
  availabilityNote: string | null;
  rateMinor: number | null;
  rateCurrency: string | null;
  website: string | null;
};

export function BasicsForm({
  profile,
  countries,
  timeZones,
  currencies,
}: {
  profile: ProfileBasics;
  countries: Option[];
  timeZones: string[];
  currencies: readonly string[];
}) {
  const t = useTranslations("expert.profile");
  const tForms = useTranslations("forms");
  const [state, action] = useActionState(saveProfileAction, idleState);
  const options = (group: "providerType" | "experience" | "availability", values: readonly string[]) =>
    values.map((value) => ({ value, label: t(`options.${group}.${value}` as never) }));
  const currency = profile.rateCurrency ?? "USD";

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <SelectField
        name="providerType"
        label={t("fields.providerType")}
        state={state}
        defaultValue={profile.providerType}
        options={options("providerType", ["individual", "agency"])}
      />
      <TextField
        name="displayName"
        label={t("fields.displayName")}
        hint={t("fields.displayNameHint")}
        state={state}
        defaultValue={profile.displayName}
        maxLength={80}
        required
      />
      <TextField
        name="headline"
        label={t("fields.headline")}
        hint={t("fields.headlineHint")}
        state={state}
        defaultValue={profile.headline}
        maxLength={120}
      />
      <TextAreaField
        name="bio"
        label={t("fields.bio")}
        hint={t("fields.bioHint")}
        state={state}
        defaultValue={profile.bio}
        maxLength={5000}
        rows={8}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="country"
          label={t("fields.country")}
          state={state}
          defaultValue={profile.country}
          options={countries}
          placeholder={tForms("selectPlaceholder")}
        />
        <TextField name="city" label={t("fields.city")} state={state} defaultValue={profile.city} maxLength={80} optional />
      </div>
      <SelectField
        name="timezone"
        label={t("fields.timezone")}
        state={state}
        defaultValue={profile.timezone}
        options={timeZones.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="experienceLevel"
          label={t("fields.experienceLevel")}
          state={state}
          defaultValue={profile.experienceLevel}
          options={options("experience", ["emerging", "established", "expert"])}
          placeholder={tForms("selectPlaceholder")}
        />
        <TextField
          name="yearsExperience"
          label={t("fields.yearsExperience")}
          state={state}
          defaultValue={profile.yearsExperience}
          type="number"
          inputMode="numeric"
          min={0}
          max={60}
          optional
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="availability"
          label={t("fields.availability")}
          state={state}
          defaultValue={profile.availability}
          options={options("availability", ["available", "limited", "unavailable"])}
        />
        <TextField
          name="availabilityNote"
          label={t("fields.availabilityNote")}
          hint={t("fields.availabilityNoteHint")}
          state={state}
          defaultValue={profile.availabilityNote}
          maxLength={200}
          optional
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <TextField
          name="rate"
          label={t("fields.rate")}
          hint={t("fields.rateHint")}
          state={state}
          defaultValue={profile.rateMinor === null ? null : minorToDecimalString(profile.rateMinor, currency)}
          inputMode="decimal"
          optional
        />
        <SelectField
          name="rateCurrency"
          label={t("fields.rateCurrency")}
          state={state}
          defaultValue={currency}
          options={currencies.map((code) => ({ value: code, label: code }))}
        />
      </div>
      <TextField
        name="website"
        label={t("fields.website")}
        state={state}
        defaultValue={profile.website}
        type="url"
        inputMode="url"
        placeholder="https://"
        optional
      />
      <FormActions>
        <PendingButton>{tForms("saveChanges")}</PendingButton>
      </FormActions>
    </form>
  );
}

export type AgencyValues = {
  foundedYear: number | null;
  teamSize: string | null;
  offices: string[];
  legalName: string | null;
  registrationNumber: string | null;
};

export function AgencyForm({ agency, teamSizes }: { agency: AgencyValues; teamSizes: readonly string[] }) {
  const t = useTranslations("expert.profile.fields");
  const tForms = useTranslations("forms");
  const [state, action] = useActionState(saveAgencyAction, idleState);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="foundedYear"
          label={t("foundedYear")}
          state={state}
          defaultValue={agency.foundedYear}
          type="number"
          inputMode="numeric"
          optional
        />
        <SelectField
          name="teamSize"
          label={t("teamSize")}
          state={state}
          defaultValue={agency.teamSize}
          options={teamSizes.map((size) => ({ value: size, label: size }))}
          placeholder={tForms("selectPlaceholder")}
          optional
        />
      </div>
      <TextField
        name="offices"
        label={t("offices")}
        hint={t("officesHint")}
        state={state}
        defaultValue={agency.offices.join(", ")}
        optional
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="legalName"
          label={t("legalName")}
          hint={t("privateHint")}
          state={state}
          defaultValue={agency.legalName}
          maxLength={160}
          optional
        />
        <TextField
          name="registrationNumber"
          label={t("registrationNumber")}
          hint={t("privateHint")}
          state={state}
          defaultValue={agency.registrationNumber}
          maxLength={64}
          optional
        />
      </div>
      <FormActions>
        <PendingButton>{tForms("saveChanges")}</PendingButton>
      </FormActions>
    </form>
  );
}

export function SkillsForm({
  terms,
  selected,
  max,
  kindLabels,
}: {
  terms: PickerTerm[];
  selected: string[];
  max: number;
  kindLabels: Record<string, string>;
}) {
  const t = useTranslations("expert.profile");
  const tForms = useTranslations("forms");
  const [state, action] = useActionState(saveTermsAction, idleState);
  return (
    <form action={action} className="grid gap-4">
      <FormStatus state={state} />
      <TermPicker
        name="terms"
        label={t("fields.skills")}
        terms={terms}
        selected={selected}
        max={max}
        kindLabels={kindLabels}
        error={state.fieldErrors?.terms}
      />
      <FormActions>
        <PendingButton>{tForms("saveChanges")}</PendingButton>
      </FormActions>
    </form>
  );
}

export function LanguagesForm({
  languages,
  languageOptions,
}: {
  languages: { code: string; name: string; proficiency: string }[];
  languageOptions: Option[];
}) {
  const t = useTranslations("expert.profile");
  const tForms = useTranslations("forms");
  const [state, action] = useActionState(addLanguageAction, idleState);
  const proficiencies = ["basic", "conversational", "fluent", "native"].map((value) => ({
    value,
    label: t(`options.proficiency.${value}` as never),
  }));
  return (
    <div className="grid gap-4">
      {languages.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("fields.noLanguages")}</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {languages.map((language) => (
            <li key={language.code} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span>
                <span className="font-medium">{language.name}</span>
                <span className="text-ink-muted">{` · ${t(`options.proficiency.${language.proficiency}` as never)}`}</span>
              </span>
              <form action={removeLanguageAction}>
                <input type="hidden" name="language" value={language.code} />
                <Button type="submit" variant="ghost" size="sm" aria-label={`${tForms("remove")} ${language.name}`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="grid gap-4" key={state.at}>
        <FormStatus state={state} />
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <SelectField
            name="language"
            label={t("fields.language")}
            state={state}
            options={languageOptions}
            placeholder={tForms("selectPlaceholder")}
          />
          <SelectField name="proficiency" label={t("fields.proficiency")} state={state} defaultValue="fluent" options={proficiencies} />
          <PendingButton variant="secondary">{t("fields.addLanguage")}</PendingButton>
        </div>
      </form>
    </div>
  );
}

export function LinksForm({ links }: { links: { id: string; kind: string; url: string }[] }) {
  const t = useTranslations("expert.profile");
  const tForms = useTranslations("forms");
  const [state, action] = useActionState(addLinkAction, idleState);
  const kinds = ["website", "github", "linkedin", "huggingface", "kaggle", "x", "youtube", "scholar", "other"].map((value) => ({
    value,
    label: t(`options.linkKind.${value}` as never),
  }));
  return (
    <div className="grid gap-4">
      {links.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("fields.noLinks")}</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0">
                <span className="font-medium">{t(`options.linkKind.${link.kind}` as never)}</span>
                <span className="block truncate text-sm text-ink-muted">{link.url}</span>
              </span>
              <form action={removeLinkAction}>
                <input type="hidden" name="id" value={link.id} />
                <Button type="submit" variant="ghost" size="sm" aria-label={`${tForms("remove")} ${link.url}`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="grid gap-4" key={state.at} noValidate>
        <FormStatus state={state} />
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <SelectField name="kind" label={t("fields.linkKind")} state={state} defaultValue="website" options={kinds} />
          <TextField name="url" label={t("fields.linkUrl")} state={state} type="url" inputMode="url" placeholder="https://" />
          <PendingButton variant="secondary">{t("fields.addLink")}</PendingButton>
        </div>
      </form>
    </div>
  );
}

export function SubmitProfileForm({ checklistLabels, disabled }: { checklistLabels: Record<string, string>; disabled: boolean }) {
  const t = useTranslations("expert.profile");
  const [state, action] = useActionState(submitProfileAction, idleState);
  return (
    <form action={action} className="grid gap-3">
      <FormStatus state={state} checklistLabels={checklistLabels} />
      <div>
        <PendingButton disabled={disabled}>{t("submit")}</PendingButton>
      </div>
      <p className="text-sm text-ink-muted">{t("submitHint")}</p>
    </form>
  );
}

export function SuggestTermForm() {
  const t = useTranslations("expert.profile.suggest");
  const [state, action] = useActionState(suggestTermAction, idleState);
  const kinds = (["skill", "technology", "industry"] as const).map((value) => ({ value, label: t(`kinds.${value}`) }));
  return (
    <form action={action} className="grid gap-3 rounded-md border border-dashed border-line p-4" key={state.at} noValidate>
      <div className="grid gap-0.5">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="text-sm text-ink-muted">{t("description")}</p>
      </div>
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <SelectField name="kind" label={t("kind")} state={state} defaultValue="skill" options={kinds} />
        <TextField name="name" label={t("name")} state={state} maxLength={60} />
        <PendingButton variant="secondary">{t("submit")}</PendingButton>
      </div>
    </form>
  );
}
