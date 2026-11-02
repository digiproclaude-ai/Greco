"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/form-parts";
import { FormActions, FormStatus, SelectField, TextField, type Option } from "@/components/forms/fields";
import { createListingAction } from "@/server/modules/catalog/actions";
import { idleState } from "@/server/modules/shared/action-state";

export function NewListingForm({ categories }: { categories: Option[] }) {
  const t = useTranslations("listing");
  const tForms = useTranslations("forms");
  const [state, action] = useActionState(createListingAction, idleState);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <TextField name="title" label={t("new.titleLabel")} hint={t("fields.titleHint")} state={state} maxLength={100} required />
      <SelectField
        name="primaryCategory"
        label={t("new.category")}
        state={state}
        options={categories}
        placeholder={tForms("selectPlaceholder")}
      />
      <FormActions>
        <SubmitButton>{t("new.create")}</SubmitButton>
      </FormActions>
    </form>
  );
}
