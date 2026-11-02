"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/auth/form-parts";
import { FormActions, FormStatus, SelectField, TextAreaField, TextField, fieldValue, type Option } from "@/components/forms/fields";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { saveClientProfileAction } from "@/server/modules/clients/actions";
import { idleState } from "@/server/modules/shared/action-state";

export type ClientProfileValues = {
  accountType: string | null;
  businessName: string | null;
  industry: string | null;
  companySize: string | null;
  website: string | null;
  purpose: string | null;
  challenges: string | null;
};

export function ClientProfileForm({ values, industries }: { values: ClientProfileValues; industries: Option[] }) {
  const t = useTranslations("client.profile");
  const tForms = useTranslations("forms");
  const [state, action] = useActionState(saveClientProfileAction, idleState);
  const [accountType, setAccountType] = useState(fieldValue(state, "accountType", values.accountType) || "individual");
  const sizes = (["1", "2-10", "11-50", "51-200", "201-1000", "1000+"] as const).map((value) => ({
    value,
    label: t(`companySizes.${value}`),
  }));

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t("fields.accountType")}</legend>
        <RadioGroup name="accountType" value={accountType} onValueChange={setAccountType} className="sm:grid-cols-2">
          <RadioCard value="individual" title={t("accountTypes.individual")} />
          <RadioCard value="business" title={t("accountTypes.business")} />
        </RadioGroup>
      </fieldset>
      {accountType === "business" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="businessName"
            label={t("fields.businessName")}
            state={state}
            defaultValue={values.businessName}
            maxLength={160}
            required
          />
          <SelectField
            name="companySize"
            label={t("fields.companySize")}
            state={state}
            defaultValue={values.companySize}
            options={sizes}
            placeholder={tForms("selectPlaceholder")}
            optional
          />
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="industry"
          label={t("fields.industry")}
          state={state}
          defaultValue={values.industry}
          options={industries}
          placeholder={tForms("selectPlaceholder")}
          optional
        />
        <TextField
          name="website"
          label={t("fields.website")}
          state={state}
          defaultValue={values.website}
          type="url"
          placeholder="https://"
          optional
        />
      </div>
      <TextAreaField
        name="purpose"
        label={t("fields.purpose")}
        hint={t("fields.purposeHint")}
        state={state}
        defaultValue={values.purpose}
        maxLength={500}
        rows={3}
        optional
      />
      <TextAreaField
        name="challenges"
        label={t("fields.challenges")}
        hint={t("fields.challengesHint")}
        state={state}
        defaultValue={values.challenges}
        maxLength={2000}
        optional
      />
      <FormActions>
        <SubmitButton>{t("save")}</SubmitButton>
      </FormActions>
    </form>
  );
}
