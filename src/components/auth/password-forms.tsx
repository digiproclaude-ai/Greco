"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { forgotPasswordAction, resetPasswordAction } from "@/server/modules/identity/actions";
import { initialFormState } from "@/server/modules/identity/form-state";

import { FormErrorAlert, FormField, SubmitButton } from "./form-parts";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const [state, formAction] = useActionState(forgotPasswordAction, initialFormState);

  if (state.status === "success") {
    return (
      <div className="grid gap-4">
        <Alert variant="success">{t("sent")}</Alert>
        <Link href="/login" className="text-sm text-accent hover:underline">
          {t("back")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormErrorAlert state={state} />
      <FormField name="email" label={t("email")} error={state.fieldErrors?.email}>
        {(aria) => (
          <Input {...aria} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        )}
      </FormField>
      <SubmitButton size="lg">{t("submit")}</SubmitButton>
      <Link href="/login" className="text-sm text-accent hover:underline">
        {t("back")}
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const tRegister = useTranslations("auth.register");
  const [state, formAction] = useActionState(resetPasswordAction, initialFormState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormErrorAlert state={state} />
      <FormField name="password" label={t("password")} hint={tRegister("passwordHint")} error={state.fieldErrors?.password}>
        {(aria) => <Input {...aria} name="password" type="password" autoComplete="new-password" minLength={10} required />}
      </FormField>
      <FormField name="confirm" label={t("confirm")} error={state.fieldErrors?.confirm}>
        {(aria) => <Input {...aria} name="confirm" type="password" autoComplete="new-password" required />}
      </FormField>
      <SubmitButton size="lg">{t("submit")}</SubmitButton>
    </form>
  );
}
