"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { Link } from "@/i18n/navigation";
import { googleSignInAction, registerAction } from "@/server/modules/identity/actions";
import { initialFormState } from "@/server/modules/identity/form-state";

import { FormErrorAlert, FormField, SubmitButton, TranslatedFieldError } from "./form-parts";

export type CountryOption = { code: string; name: string };

export function RegisterForm({
  countries,
  defaultRole,
  googleEnabled,
}: {
  countries: CountryOption[];
  defaultRole: "client" | "expert" | null;
  googleEnabled: boolean;
}) {
  const t = useTranslations("auth.register");
  const tLogin = useTranslations("auth.login");
  const [state, formAction] = useActionState(registerAction, initialFormState);
  const role = state.values?.role || defaultRole || undefined;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <input type="hidden" name="intent" value="register" />
      <FormErrorAlert state={state} />

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">{t("roleLabel")}</legend>
        <RadioGroup
          name="role"
          defaultValue={role}
          aria-invalid={state.fieldErrors?.role ? true : undefined}
          aria-describedby={state.fieldErrors?.role ? "field-role-error" : undefined}
          className="sm:grid-cols-2"
        >
          <RadioCard value="client" title={t("roles.client.title")} description={t("roles.client.description")} />
          <RadioCard value="expert" title={t("roles.expert.title")} description={t("roles.expert.description")} />
        </RadioGroup>
        <TranslatedFieldError id="field-role-error" error={state.fieldErrors?.role} />
      </fieldset>

      <FormField name="fullName" label={t("fullName")} hint={t("fullNameHint")} error={state.fieldErrors?.fullName}>
        {(aria) => <Input {...aria} name="fullName" autoComplete="name" required defaultValue={state.values?.fullName} />}
      </FormField>
      <FormField name="email" label={t("email")} error={state.fieldErrors?.email}>
        {(aria) => (
          <Input {...aria} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        )}
      </FormField>
      <FormField name="password" label={t("password")} hint={t("passwordHint")} error={state.fieldErrors?.password}>
        {(aria) => <Input {...aria} name="password" type="password" autoComplete="new-password" minLength={10} required />}
      </FormField>
      <FormField name="country" label={t("country")} error={state.fieldErrors?.country}>
        {(aria) => (
          <NativeSelect {...aria} name="country" autoComplete="country" required defaultValue={state.values?.country ?? ""}>
            <option value="" disabled>
              {t("countryPlaceholder")}
            </option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <Field>
        <div className="flex items-start gap-3">
          <Checkbox
            id="field-legal"
            name="legal"
            value="on"
            aria-invalid={state.fieldErrors?.legal ? true : undefined}
            aria-describedby={state.fieldErrors?.legal ? "field-legal-error" : undefined}
          />
          <Label htmlFor="field-legal" className="font-normal">
            {t.rich("legal", {
              terms: (chunks) => (
                <Link href="/legal/terms" target="_blank" className="text-accent underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/legal/privacy" target="_blank" className="text-accent underline">
                  {chunks}
                </Link>
              ),
            })}
          </Label>
        </div>
        <TranslatedFieldError id="field-legal-error" error={state.fieldErrors?.legal} />
      </Field>

      <SubmitButton size="lg">{t("submit")}</SubmitButton>

      {googleEnabled ? (
        <>
          <p className="text-center text-sm text-ink-muted">{tLogin("or")}</p>
          <SubmitButton variant="secondary" size="lg" formAction={googleSignInAction} formNoValidate>
            {tLogin("google")}
          </SubmitButton>
        </>
      ) : null}

      <p className="text-sm text-ink-muted">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          {t("loginLink")}
        </Link>
      </p>
    </form>
  );
}
