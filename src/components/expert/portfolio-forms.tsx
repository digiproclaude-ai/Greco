"use client";

import { Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/form-parts";
import { FormActions, FormStatus, SelectField, TextAreaField, TextField, type Option } from "@/components/forms/fields";
import { TermPicker, type PickerTerm } from "@/components/forms/term-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleState, type ActionState } from "@/server/modules/shared/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export type PortfolioValues = {
  title: string;
  summary: string | null;
  problem: string | null;
  solution: string | null;
  results: string | null;
  role: string | null;
  clientName: string | null;
  industry: string | null;
  projectMonth: string | null;
  externalUrl: string | null;
  status: string;
  termIds: string[];
};

export const EMPTY_PORTFOLIO: PortfolioValues = {
  title: "",
  summary: null,
  problem: null,
  solution: null,
  results: null,
  role: null,
  clientName: null,
  industry: null,
  projectMonth: null,
  externalUrl: null,
  status: "published",
  termIds: [],
};

export function PortfolioItemForm({
  action,
  values,
  industries,
  terms,
  kindLabels,
  maxTerms,
  submitLabel,
}: {
  action: Action;
  values: PortfolioValues;
  industries: Option[];
  terms: PickerTerm[];
  kindLabels: Record<string, string>;
  maxTerms: number;
  submitLabel: string;
}) {
  const t = useTranslations("expert.portfolio");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(action, idleState);
  const statuses = (["published", "draft", "hidden"] as const).map((value) => ({ value, label: t(`statuses.${value}`) }));
  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormStatus state={state} />
      <TextField name="title" label={t("fields.title")} state={state} defaultValue={values.title} maxLength={120} required />
      <TextAreaField
        name="summary"
        label={t("fields.summary")}
        hint={t("fields.summaryHint")}
        state={state}
        defaultValue={values.summary}
        maxLength={300}
        rows={2}
        optional
      />
      <TextAreaField name="problem" label={t("fields.problem")} state={state} defaultValue={values.problem} maxLength={2000} optional />
      <TextAreaField name="solution" label={t("fields.solution")} state={state} defaultValue={values.solution} maxLength={3000} rows={6} optional />
      <TextAreaField
        name="results"
        label={t("fields.results")}
        hint={t("fields.resultsHint")}
        state={state}
        defaultValue={values.results}
        maxLength={2000}
        optional
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="role" label={t("fields.role")} state={state} defaultValue={values.role} maxLength={120} optional />
        <TextField
          name="clientName"
          label={t("fields.clientName")}
          hint={t("fields.clientNameHint")}
          state={state}
          defaultValue={values.clientName}
          maxLength={120}
          optional
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="industry"
          label={t("fields.industry")}
          state={state}
          defaultValue={values.industry}
          options={industries}
          placeholder={tForms("none")}
          optional
        />
        <TextField
          name="projectMonth"
          label={t("fields.projectDate")}
          state={state}
          defaultValue={values.projectMonth}
          type="month"
          optional
        />
      </div>
      <TextField
        name="externalUrl"
        label={t("fields.externalUrl")}
        state={state}
        defaultValue={values.externalUrl}
        type="url"
        placeholder="https://"
        optional
      />
      <TermPicker
        name="terms"
        label={t("fields.terms")}
        terms={terms}
        selected={values.termIds}
        max={maxTerms}
        kindLabels={kindLabels}
        error={state.fieldErrors?.terms}
      />
      <SelectField name="status" label={t("fields.status")} state={state} defaultValue={values.status} options={statuses} />
      <FormActions>
        <SubmitButton>{submitLabel}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function PortfolioImages({
  images,
  uploadAction,
  removeAction,
  max,
}: {
  images: { id: string; caption: string | null; url: string | null }[];
  uploadAction: Action;
  removeAction: (formData: FormData) => Promise<void>;
  max: number;
}) {
  const t = useTranslations("expert.portfolio.fields");
  const tForms = useTranslations("forms");
  const [state, formAction] = useActionState(uploadAction, idleState);
  return (
    <div className="grid gap-5">
      {images.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {images.map((image) => (
            <li key={image.id} className="overflow-hidden rounded-md border border-line">
              {image.url ? (
                <Image
                  src={image.url}
                  alt={image.caption ?? ""}
                  width={640}
                  height={400}
                  className="aspect-[16/10] w-full bg-paper object-cover"
                  unoptimized
                />
              ) : null}
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-sm text-ink-muted">{image.caption}</span>
                <form action={removeAction}>
                  <input type="hidden" name="mediaId" value={image.id} />
                  <Button type="submit" variant="ghost" size="sm" aria-label={tForms("remove")}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {images.length < max ? (
        <form action={formAction} className="grid gap-4" key={state.at}>
          <FormStatus state={state} />
          <div className="grid gap-1.5">
            <Label htmlFor="field-image">{t("imageFile")}</Label>
            <Input id="field-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required className="py-1.5" />
          </div>
          <TextField name="caption" label={t("caption")} state={state} maxLength={200} optional />
          <FormActions>
            <SubmitButton variant="secondary">{t("upload")}</SubmitButton>
          </FormActions>
        </form>
      ) : null}
    </div>
  );
}

export function DeleteButton({ action, label, confirm }: { action: () => Promise<void>; label: string; confirm: string }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
    >
      <Button type="submit" variant="danger" size="sm">
        <Trash2 aria-hidden="true" />
        {label}
      </Button>
    </form>
  );
}
