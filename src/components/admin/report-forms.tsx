"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/form-parts";
import { FormStatus, SelectField, TextAreaField } from "@/components/forms/fields";
import { idleState, type ActionState } from "@/server/modules/shared/action-state";

type StateAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ResolveReportForm({ action }: { action: StateAction }) {
  const t = useTranslations("admin.reports.resolve");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormStatus state={state} />
      <SelectField
        name="outcome"
        idPrefix="resolve"
        label={t("outcome")}
        state={state}
        defaultValue="dismissed"
        options={[
          { value: "dismissed", label: t("dismissed") },
          { value: "actioned", label: t("actioned") },
        ]}
      />
      <TextAreaField name="note" idPrefix="resolve" label={t("note")} hint={t("noteHint")} state={state} maxLength={2000} rows={3} optional />
      <div>
        <SubmitButton>{t("submit")}</SubmitButton>
      </div>
    </form>
  );
}

/** Remove (with a statement of reasons) or restore a message or project. */
export function ModerateForm({ action, kind, removed }: { action: StateAction; kind: "message" | "project"; removed: boolean }) {
  const t = useTranslations(`admin.reports.${kind}`);
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-3" noValidate>
      <FormStatus state={state} />
      <input type="hidden" name="action" value={removed ? "restore" : "remove"} />
      {removed ? null : (
        <TextAreaField name="reason" idPrefix={`${kind}-moderate`} label={t("reason")} hint={t("reasonHint")} state={state} maxLength={2000} rows={3} />
      )}
      <div>
        <SubmitButton size="sm" variant={removed ? "secondary" : "danger"}>
          {removed ? t("restore") : t("remove")}
        </SubmitButton>
      </div>
    </form>
  );
}
