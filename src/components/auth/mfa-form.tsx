"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { verifyMfaAction } from "@/server/modules/identity/actions";
import { initialFormState } from "@/server/modules/identity/form-state";

import { FormErrorAlert, FormField, SubmitButton } from "./form-parts";

export function MfaChallengeForm({ next }: { next: string }) {
  const t = useTranslations("auth.mfa");
  const [state, formAction] = useActionState(verifyMfaAction, initialFormState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormErrorAlert state={state} />
      <FormField name="code" label={t("code")} error={state.fieldErrors?.code}>
        {(aria) => (
          <Input
            {...aria}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            className="tabular font-mono tracking-[0.3em]"
          />
        )}
      </FormField>
      <SubmitButton size="lg">{t("submit")}</SubmitButton>
    </form>
  );
}
