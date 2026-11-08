"use client";

import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/auth/form-parts";
import { FormActions, FormStatus, SelectField, TextAreaField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { REPORT_REASONS } from "@/server/modules/messaging/schemas";
import { idleState, type ActionState } from "@/server/modules/shared/action-state";

/** "Report" link that opens a small form; one per reportable item. */
export function ReportForm({
  action,
  label,
  idPrefix,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  idPrefix: string;
}) {
  const t = useTranslations("inbox.report");
  const [state, formAction] = useActionState(action, idleState);
  const [open, setOpen] = useState(false);

  if (state.status === "success") return <FormStatus state={state} />;
  if (!open) {
    return (
      <Button type="button" variant="link" size="sm" className="text-xs text-ink-muted" onClick={() => setOpen(true)}>
        <Flag aria-hidden="true" />
        {label}
      </Button>
    );
  }
  return (
    <form action={formAction} className="grid gap-3 rounded-md border border-line bg-surface p-4 text-start text-ink">
      <p className="font-semibold">{t("title")}</p>
      <FormStatus state={state} />
      <SelectField
        name="reason"
        idPrefix={idPrefix}
        label={t("reason")}
        state={state}
        options={REPORT_REASONS.map((reason) => ({ value: reason, label: t(`reasons.${reason}`) }))}
        defaultValue="spam"
      />
      <TextAreaField
        name="details"
        idPrefix={idPrefix}
        label={t("details")}
        hint={t("detailsHint")}
        state={state}
        maxLength={2000}
        rows={3}
        optional
      />
      <FormActions>
        <SubmitButton size="sm" variant="danger">
          {t("submit")}
        </SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </FormActions>
    </form>
  );
}
