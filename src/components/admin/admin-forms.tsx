"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/form-parts";
import { FormActions, FormStatus, SelectField, TextAreaField, TextField, type Option } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { idleState, type ActionState } from "@/server/modules/shared/action-state";

type StateAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function DecisionForm({ action, isEdit }: { action: StateAction; isEdit: boolean }) {
  const t = useTranslations("admin.moderation.detail");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormStatus state={state} />
      <TextAreaField name="reason" label={t("reason")} hint={t("reasonHint")} state={state} maxLength={2000} rows={5} />
      <FormActions>
        <SubmitButton name="decision" value="approve">
          {isEdit ? t("approveEdit") : t("approve")}
        </SubmitButton>
        <SubmitButton name="decision" value="reject" variant="danger">
          {t("reject")}
        </SubmitButton>
      </FormActions>
    </form>
  );
}

export function ContentStatusForm({
  action,
  targetType,
  targetId,
  suspended,
}: {
  action: StateAction;
  targetType: "provider" | "listing";
  targetId: string;
  suspended: boolean;
}) {
  const t = useTranslations("admin.catalog");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-2" noValidate>
      <FormStatus state={state} />
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="action" value={suspended ? "reinstate" : "suspend"} />
      {suspended ? null : (
        <TextField name="reason" label={t("reason")} hint={t("reasonHint")} state={state} maxLength={2000} />
      )}
      <div>
        <SubmitButton size="sm" variant={suspended ? "secondary" : "danger"}>
          {suspended ? t("reinstate") : t("suspend")}
        </SubmitButton>
      </div>
    </form>
  );
}

export type CategoryValues = {
  parentId: string | null;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  iconKey: string | null;
  sortOrder: number;
  isVisible: boolean;
};

export function CategoryForm({ action, values, parents }: { action: StateAction; values: CategoryValues; parents: Option[] }) {
  const t = useTranslations("admin.categories");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <SelectField
        name="parentId"
        label={t("fields.parent")}
        state={state}
        defaultValue={values.parentId}
        options={parents}
        placeholder={t("fields.noParent")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label={t("fields.name")} state={state} defaultValue={values.name} maxLength={80} required />
        <TextField
          name="slug"
          label={t("fields.slug")}
          hint={t("fields.slugHint")}
          state={state}
          defaultValue={values.slug}
          maxLength={60}
          required
        />
      </div>
      <TextField
        name="shortDescription"
        label={t("fields.shortDescription")}
        state={state}
        defaultValue={values.shortDescription}
        maxLength={160}
        optional
      />
      <TextAreaField name="description" label={t("fields.description")} state={state} defaultValue={values.description} maxLength={2000} optional />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="iconKey"
          label={t("fields.iconKey")}
          hint={t("fields.iconKeyHint")}
          state={state}
          defaultValue={values.iconKey}
          maxLength={40}
          optional
        />
        <TextField name="sortOrder" label={t("fields.sortOrder")} state={state} defaultValue={values.sortOrder} type="number" />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="field-isVisible" name="isVisible" defaultChecked={values.isVisible} />
        <Label htmlFor="field-isVisible">{t("fields.isVisible")}</Label>
      </div>
      <FormActions>
        <SubmitButton>{t("save")}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function ReassignForm({ action, targets }: { action: StateAction; targets: Option[] }) {
  const t = useTranslations("admin.categories.reassign");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormStatus state={state} />
      <SelectField name="target" label={t("target")} state={state} options={targets} placeholder={tForms("selectPlaceholder")} />
      <FormActions>
        <SubmitButton variant="secondary">{t("submit")}</SubmitButton>
      </FormActions>
    </form>
  );
}

export type TermValues = { kind: string; slug: string; name: string; description: string | null; aliases: string[] };

export function TermForm({ action, values, kinds }: { action: StateAction; values: TermValues; kinds: Option[] }) {
  const t = useTranslations("admin.taxonomy");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <div className="grid gap-5 sm:grid-cols-3">
        <SelectField name="kind" label={t("fields.kind")} state={state} defaultValue={values.kind} options={kinds} />
        <TextField name="name" label={t("fields.name")} state={state} defaultValue={values.name} maxLength={80} required />
        <TextField name="slug" label={t("fields.slug")} state={state} defaultValue={values.slug} maxLength={60} required />
      </div>
      <TextField name="description" label={t("fields.description")} state={state} defaultValue={values.description} maxLength={500} optional />
      <TextField
        name="aliases"
        label={t("fields.aliases")}
        hint={t("fields.aliasesHint")}
        state={state}
        defaultValue={values.aliases.join(", ")}
        optional
      />
      <FormActions>
        <SubmitButton>{t("save")}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function MergeForm({ action, fromId, targets }: { action: StateAction; fromId: string; targets: Option[] }) {
  const t = useTranslations("admin.taxonomy");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-2" noValidate>
      <FormStatus state={state} />
      <input type="hidden" name="from" value={fromId} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <SelectField name="into" label={t("mergeInto")} state={state} options={targets} placeholder={tForms("selectPlaceholder")} />
        </div>
        <SubmitButton variant="secondary" size="md">
          {t("merge")}
        </SubmitButton>
      </div>
      <p className="text-xs text-ink-muted">{t("mergeHint")}</p>
    </form>
  );
}

export function InlineAction({ action, fields, label, variant = "secondary" }: { action: (formData: FormData) => Promise<void>; fields: Record<string, string>; label: string; variant?: "secondary" | "ghost" | "danger" }) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  );
}
