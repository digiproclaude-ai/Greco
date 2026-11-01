"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";

import { FormErrorAlert, FormField, SubmitButton } from "@/components/auth/form-parts";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  confirmMfaEnrollmentAction,
  startMfaEnrollmentAction,
  type MfaEnrollment,
} from "@/server/modules/identity/actions";
import { initialFormState } from "@/server/modules/identity/form-state";

export function MfaSetup() {
  const t = useTranslations("dashboard.settings.mfa");
  const tErrors = useTranslations("auth.errors");
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [starting, startTransition] = useTransition();
  const [state, formAction] = useActionState(confirmMfaEnrollmentAction, initialFormState);

  if (state.status === "success") return <Alert variant="success">{t("done")}</Alert>;

  if (!enrollment || enrollment.status === "error") {
    return (
      <div className="grid justify-items-start gap-3">
        {enrollment?.status === "error" ? <Alert variant="danger">{tErrors("generic")}</Alert> : null}
        <Button
          disabled={starting}
          onClick={() => startTransition(async () => setEnrollment(await startMfaEnrollmentAction()))}
        >
          {t("start")}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <p className="text-[15px] text-ink-muted">{t("scan")}</p>
      <div className="flex flex-wrap items-center gap-6">
        {/* Supabase returns the QR code as an SVG data URI. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrollment.qrCode} alt={t("qrAlt")} width={176} height={176} className="rounded-md border border-line bg-white p-2" />
        <div className="grid gap-1">
          <p className="text-sm font-medium">{t("secret")}</p>
          <code className="rounded-sm bg-paper px-2 py-1 font-mono text-sm break-all">{enrollment.secret}</code>
        </div>
      </div>
      <form action={formAction} className="grid max-w-xs gap-4" noValidate>
        <input type="hidden" name="factorId" value={enrollment.factorId} />
        <FormErrorAlert state={state} />
        <FormField name="code" label={t("code")} error={state.fieldErrors?.code}>
          {(aria) => (
            <Input
              {...aria}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              className="tabular font-mono tracking-[0.3em]"
            />
          )}
        </FormField>
        <SubmitButton>{t("verify")}</SubmitButton>
      </form>
    </div>
  );
}
