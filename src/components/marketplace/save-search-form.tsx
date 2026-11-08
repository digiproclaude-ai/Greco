"use client";

import { BellPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/auth/form-parts";
import { FormStatus, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/server/modules/shared/action-state";

export function SaveSearchForm({
  action,
  defaultName,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  defaultName: string;
}) {
  const t = useTranslations("marketplace.save");
  const [state, formAction] = useActionState(action, idleState);
  const [open, setOpen] = useState(false);
  if (state.status === "success") return <FormStatus state={state} />;
  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <BellPlus aria-hidden="true" />
        {t("saveSearch")}
      </Button>
    );
  }
  return (
    <form action={formAction} className="grid gap-3 rounded-md border border-line bg-surface p-4 sm:max-w-md">
      <FormStatus state={state} />
      <TextField name="name" idPrefix="saved-search" label={t("searchName")} state={state} defaultValue={defaultName} maxLength={80} required />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="alerts" defaultChecked className="size-4" />
        {t("alerts")}
      </label>
      <div className="flex gap-2">
        <SubmitButton size="sm">{t("saveSearchSubmit")}</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
