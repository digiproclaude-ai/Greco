"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { googleSignInAction, loginAction } from "@/server/modules/identity/actions";
import { initialFormState } from "@/server/modules/identity/form-state";

import { FormErrorAlert, FormField, SubmitButton } from "./form-parts";

export function LoginForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const t = useTranslations("auth.login");
  const [state, formAction] = useActionState(loginAction, initialFormState);

  return (
    <div className="grid gap-5">
      <form action={formAction} className="grid gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <FormErrorAlert state={state} />
        <FormField name="email" label={t("email")} error={state.fieldErrors?.email}>
          {(aria) => (
            <Input {...aria} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
          )}
        </FormField>
        <FormField name="password" label={t("password")} error={state.fieldErrors?.password}>
          {(aria) => <Input {...aria} name="password" type="password" autoComplete="current-password" required />}
        </FormField>
        <div className="flex items-center justify-between gap-4">
          <Link href="/forgot-password" className="text-sm text-accent hover:underline">
            {t("forgot")}
          </Link>
        </div>
        <SubmitButton size="lg">{t("submit")}</SubmitButton>
      </form>

      {googleEnabled ? (
        <form action={googleSignInAction} className="grid gap-4">
          <input type="hidden" name="intent" value="login" />
          <input type="hidden" name="next" value={next} />
          <p className="text-center text-sm text-ink-muted">{t("or")}</p>
          <SubmitButton variant="secondary" size="lg">
            {t("google")}
          </SubmitButton>
        </form>
      ) : null}

      <p className="text-sm text-ink-muted">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          {t("createAccount")}
        </Link>
      </p>
    </div>
  );
}
