"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Field, FieldError, FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/server/modules/identity/form-state";
import type { FieldError as FieldErrorValue } from "@/server/modules/identity/schemas";

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

export function TranslatedFieldError({ id, error }: { id: string; error?: FieldErrorValue }) {
  const t = useTranslations("validation");
  if (!error) return null;
  return <FieldError id={id}>{t(error.key, error.values)}</FieldError>;
}

/** Label + control + hint + error, wired together for screen readers. */
export function FormField({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: FieldErrorValue;
  children: (aria: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = `field-${name}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        ...(error ? { "aria-invalid": true as const } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      })}
      {hint ? <FieldHint id={`${id}-hint`}>{hint}</FieldHint> : null}
      <TranslatedFieldError id={`${id}-error`} error={error} />
    </Field>
  );
}

export function FormErrorAlert({ state }: { state: FormState }) {
  const t = useTranslations("auth.errors");
  if (state.status !== "error" || !state.error) return null;
  return <Alert variant="danger">{t(state.error)}</Alert>;
}
