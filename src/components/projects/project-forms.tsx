"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/auth/form-parts";
import { FormActions, FormStatus, SelectField, TextAreaField, TextField, fieldValue, type Option } from "@/components/forms/fields";
import { TermPicker, type PickerTerm } from "@/components/forms/term-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { minorToDecimalString } from "@/lib/money";
import { idleState, type ActionState } from "@/server/modules/shared/action-state";

type StateAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function NewProjectForm({ action, categories }: { action: StateAction; categories: Option[] }) {
  const t = useTranslations("projects.new");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <TextField name="title" label={t("titleLabel")} hint={t("titleHint")} state={state} maxLength={120} required />
      <SelectField
        name="category"
        label={t("category")}
        state={state}
        options={categories}
        placeholder={tForms("selectPlaceholder")}
        optional
      />
      <FormActions>
        <SubmitButton>{t("create")}</SubmitButton>
      </FormActions>
    </form>
  );
}

export type ProjectValues = {
  title: string;
  description: string | null;
  businessProblem: string | null;
  desiredOutcome: string | null;
  category: string | null;
  termIds: string[];
  budgetKind: string;
  currency: string;
  budgetMinMinor: number | null;
  budgetMaxMinor: number | null;
  timelineKind: string;
  deadline: string | null;
  visibility: string;
};

export function ProjectDetailsForm({
  action,
  values,
  categories,
  terms,
  kindLabels,
  currencies,
  currencyLocked,
  maxTerms,
}: {
  action: StateAction;
  values: ProjectValues;
  categories: Option[];
  terms: PickerTerm[];
  kindLabels: Record<string, string>;
  currencies: string[];
  currencyLocked: boolean;
  maxTerms: number;
}) {
  const t = useTranslations("projects");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(action, idleState);
  const [budgetKind, setBudgetKind] = useState(fieldValue(state, "budgetKind", values.budgetKind) || "not_sure");
  const [visibility, setVisibility] = useState(values.visibility);
  const decimal = (minor: number | null) => (minor === null ? null : minorToDecimalString(minor, values.currency));
  const f = (key: string) => t(`editor.fields.${key}` as "editor.fields.title");

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <TextField name="title" label={f("title")} state={state} defaultValue={values.title} maxLength={120} required />
      <TextAreaField
        name="description"
        label={f("description")}
        hint={f("descriptionHint")}
        state={state}
        defaultValue={values.description}
        maxLength={8000}
        rows={8}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextAreaField
          name="businessProblem"
          label={f("businessProblem")}
          hint={f("businessProblemHint")}
          state={state}
          defaultValue={values.businessProblem}
          maxLength={2000}
          rows={4}
          optional
        />
        <TextAreaField
          name="desiredOutcome"
          label={f("desiredOutcome")}
          state={state}
          defaultValue={values.desiredOutcome}
          maxLength={2000}
          rows={4}
          optional
        />
      </div>
      <SelectField
        name="category"
        label={f("category")}
        state={state}
        defaultValue={values.category}
        options={categories}
        placeholder={tForms("selectPlaceholder")}
      />
      <TermPicker
        name="terms"
        label={f("terms")}
        hint={f("termsHint")}
        terms={terms}
        selected={values.termIds}
        max={maxTerms}
        kindLabels={kindLabels}
        error={state.fieldErrors?.terms}
      />

      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="field-budgetKind">{f("budgetKind")}</Label>
          <select
            id="field-budgetKind"
            name="budgetKind"
            value={budgetKind}
            onChange={(event) => setBudgetKind(event.target.value)}
            className="h-10 w-full rounded-md border border-control bg-surface px-3 text-[15px]"
          >
            {(["not_sure", "fixed", "range", "hourly"] as const).map((kind) => (
              <option key={kind} value={kind}>
                {t(`budgetKinds.${kind}`)}
              </option>
            ))}
          </select>
        </div>
        {currencyLocked ? (
          <div className="grid gap-1.5">
            <Label htmlFor="field-currency">{f("currency")}</Label>
            <Input id="field-currency" value={values.currency} readOnly aria-describedby="currency-locked" />
            <input type="hidden" name="currency" value={values.currency} />
          </div>
        ) : (
          <SelectField
            name="currency"
            label={f("currency")}
            state={state}
            defaultValue={values.currency}
            options={currencies.map((code) => ({ value: code, label: code }))}
          />
        )}
      </div>
      {currencyLocked ? (
        <p id="currency-locked" className="-mt-3 text-sm text-ink-muted">
          {f("currencyLocked")}
        </p>
      ) : null}
      {budgetKind !== "not_sure" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {budgetKind === "range" ? (
            <TextField
              name="budgetMin"
              label={f("budgetMin")}
              state={state}
              defaultValue={decimal(values.budgetMinMinor)}
              inputMode="decimal"
            />
          ) : null}
          <TextField
            name="budgetMax"
            label={budgetKind === "hourly" ? f("hourlyMax") : f("budgetMax")}
            state={state}
            defaultValue={decimal(values.budgetMaxMinor)}
            inputMode="decimal"
          />
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="timelineKind"
          label={f("timelineKind")}
          state={state}
          defaultValue={values.timelineKind}
          options={(["flexible", "asap", "weeks", "months"] as const).map((kind) => ({ value: kind, label: t(`timelineKinds.${kind}`) }))}
        />
        <TextField name="deadline" label={f("deadline")} type="date" state={state} defaultValue={values.deadline} optional />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{f("visibility")}</legend>
        <RadioGroup name="visibility" value={visibility} onValueChange={setVisibility} className="sm:grid-cols-2">
          {(["public", "invite_only"] as const).map((value) => (
            <RadioCard key={value} value={value} title={t(`visibility.${value}.title`)} description={t(`visibility.${value}.description`)} />
          ))}
        </RadioGroup>
      </fieldset>
      <FormActions>
        <SubmitButton>{tForms("saveChanges")}</SubmitButton>
      </FormActions>
    </form>
  );
}

/** A lifecycle form (publish, submit) that reports a missing checklist. */
export function ChecklistSubmitForm({
  action,
  label,
  hint,
  checklistLabels,
  disabled,
}: {
  action: () => Promise<ActionState>;
  label: string;
  hint?: string;
  checklistLabels: Record<string, string>;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-3">
      <FormStatus state={state} checklistLabels={checklistLabels} />
      <div>
        <SubmitButton disabled={disabled}>{label}</SubmitButton>
      </div>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
    </form>
  );
}

/** A button that runs a server action after the user confirms. */
export function ConfirmButton({
  action,
  label,
  confirm,
  name,
  value,
  variant = "secondary",
}: {
  action: (formData: FormData) => Promise<void>;
  label: string;
  confirm?: string;
  name?: string;
  value?: string;
  variant?: "secondary" | "ghost" | "danger" | "primary";
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <SubmitButton variant={variant} size="sm">
        {label}
      </SubmitButton>
    </form>
  );
}

export function InviteExpertForm({ action }: { action: StateAction }) {
  const t = useTranslations("projects.editor.invite");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-4" key={state.at} noValidate>
      <FormStatus state={state} />
      <p className="text-sm text-ink-muted">{t("intro")}</p>
      <TextField name="handle" label={t("handle")} state={state} maxLength={200} spellCheck={false} autoComplete="off" required />
      <TextAreaField name="message" label={t("message")} hint={t("messageHint")} state={state} maxLength={1000} rows={3} optional />
      <FormActions>
        <SubmitButton variant="secondary">{t("send")}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function AttachmentUploadForm({ action, maxMb }: { action: StateAction; maxMb: number }) {
  const t = useTranslations("projects.attachments");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-3" key={state.at}>
      <FormStatus state={state} />
      <div className="grid gap-1.5">
        <Label htmlFor="attachment-file">{t("file")}</Label>
        <Input id="attachment-file" name="file" type="file" required aria-describedby="attachment-hint" />
        <p id="attachment-hint" className="text-sm text-ink-muted">
          {t("hint", { max: maxMb })}
        </p>
      </div>
      <FormActions>
        <SubmitButton variant="secondary">{t("upload")}</SubmitButton>
      </FormActions>
    </form>
  );
}

/** Shortlist / unshortlist / decline buttons for the client on a proposal. */
export function ProposalDecisionForm({ action, status }: { action: StateAction; status: string }) {
  const t = useTranslations("projects.proposal.decide");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(action, idleState);
  const [declining, setDeclining] = useState(false);
  if (status !== "submitted" && status !== "shortlisted") return null;
  return (
    <div className="grid gap-3">
      <FormStatus state={state} />
      <div className="flex flex-wrap gap-2">
        <form action={formAction}>
          <input type="hidden" name="action" value={status === "submitted" ? "shortlist" : "unshortlist"} />
          <SubmitButton variant={status === "submitted" ? "primary" : "secondary"} size="sm">
            {status === "submitted" ? t("shortlist") : t("unshortlist")}
          </SubmitButton>
        </form>
        {!declining ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDeclining(true)}>
            {t("decline")}
          </Button>
        ) : null}
      </div>
      {declining ? (
        <form action={formAction} className="grid gap-3 rounded-md border border-line p-4">
          <input type="hidden" name="action" value="decline" />
          <TextAreaField name="reason" label={t("declineReason")} hint={t("declineReasonHint")} state={state} maxLength={1000} rows={3} optional />
          <FormActions>
            <SubmitButton variant="danger" size="sm">
              {t("declineConfirm")}
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDeclining(false)}>
              {tForms("cancel")}
            </Button>
          </FormActions>
        </form>
      ) : null}
    </div>
  );
}
