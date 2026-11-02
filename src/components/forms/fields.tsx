"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";

import { FormField, SubmitButton } from "@/components/auth/form-parts";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/server/modules/shared/action-state";

export { SubmitButton };

/** The value to show in a field: what the user typed after an error, otherwise the saved value. */
export function fieldValue(state: ActionState, name: string, saved: string | number | null | undefined): string {
  if (state.status === "error" && state.values && name in state.values) return state.values[name] ?? "";
  return saved === null || saved === undefined ? "" : String(saved);
}

/** Success or error line for an editor form. */
export function FormStatus({ state, checklistLabels }: { state: ActionState; checklistLabels?: Record<string, string> }) {
  const t = useTranslations("forms");
  if (state.status === "success" && state.message) {
    return (
      <p role="status" className="text-sm font-medium text-success">
        {t(`success.${state.message}`)}
      </p>
    );
  }
  if (state.status === "error" && state.error) {
    return (
      <Alert variant="danger">
        {t(`errors.${state.error}`, state.errorValues ?? {})}
        {state.missing && state.missing.length > 0 && checklistLabels ? (
          <ul className="mt-2 list-disc ps-5">
            {state.missing.map((key) => (
              <li key={key}>{checklistLabels[key] ?? key}</li>
            ))}
          </ul>
        ) : null}
      </Alert>
    );
  }
  return <span role="status" className="sr-only" />;
}

type BaseProps = { name: string; label: string; hint?: string; state: ActionState; optional?: boolean };

function useOptionalLabel(label: string, optional?: boolean) {
  const t = useTranslations("forms");
  return optional ? `${label} (${t("optional").toLowerCase()})` : label;
}

export function TextField({
  name,
  label,
  hint,
  state,
  optional,
  defaultValue,
  ...props
}: BaseProps & Omit<ComponentProps<"input">, "name" | "defaultValue"> & { defaultValue?: string | number | null }) {
  const fullLabel = useOptionalLabel(label, optional);
  return (
    <FormField name={name} label={fullLabel} hint={hint} error={state.fieldErrors?.[name]}>
      {(aria) => <Input {...aria} {...props} name={name} defaultValue={fieldValue(state, name, defaultValue)} />}
    </FormField>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  state,
  optional,
  defaultValue,
  ...props
}: BaseProps & Omit<ComponentProps<"textarea">, "name" | "defaultValue"> & { defaultValue?: string | null }) {
  const fullLabel = useOptionalLabel(label, optional);
  return (
    <FormField name={name} label={fullLabel} hint={hint} error={state.fieldErrors?.[name]}>
      {(aria) => <Textarea {...aria} {...props} name={name} defaultValue={fieldValue(state, name, defaultValue)} />}
    </FormField>
  );
}

export type Option = { value: string; label: string };

export function SelectField({
  name,
  label,
  hint,
  state,
  optional,
  defaultValue,
  options,
  placeholder,
  ...props
}: BaseProps &
  Omit<ComponentProps<"select">, "name" | "defaultValue"> & {
    defaultValue?: string | null;
    options: Option[];
    placeholder?: string;
  }) {
  const fullLabel = useOptionalLabel(label, optional);
  return (
    <FormField name={name} label={fullLabel} hint={hint} error={state.fieldErrors?.[name]}>
      {(aria) => (
        <NativeSelect {...aria} {...props} name={name} defaultValue={fieldValue(state, name, defaultValue)}>
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );
}

/** A titled block in an editor page. */
export function EditorSection({
  id,
  title,
  description,
  children,
  aside,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="grid gap-1">
          <h2 id={`${id}-title`} className="font-semibold">
            {title}
          </h2>
          {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
        </div>
        {aside}
      </div>
      <div className="grid gap-5 p-5">{children}</div>
    </section>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}
