import type { Messages } from "@/i18n/messages";
import type { FieldError } from "@/server/modules/identity/schemas";

export type ActionErrorKey = keyof Messages["forms"]["errors"];
export type ActionSuccessKey = keyof Messages["forms"]["success"];

/**
 * Result returned by editor Server Actions to their forms (via useActionState). Errors are
 * translation keys, never raw database or provider messages.
 */
export type ActionState = {
  status: "idle" | "error" | "success";
  error?: ActionErrorKey;
  /** Values for the error message, such as a size limit. */
  errorValues?: Record<string, number>;
  fieldErrors?: Record<string, FieldError>;
  /** Non-secret values echoed back so the form keeps what the user typed. */
  values?: Record<string, string>;
  /** Checklist keys still missing after a submit attempt. */
  missing?: string[];
  message?: ActionSuccessKey;
  /** Changes on every success so forms can reset or announce the result. */
  at?: number;
};

export const idleState: ActionState = { status: "idle" };

export function succeeded(message: ActionSuccessKey = "saved"): ActionState {
  return { status: "success", message, at: Date.now() };
}

export function failed(error: ActionErrorKey, extra: Omit<ActionState, "status" | "error"> = {}): ActionState {
  return { status: "error", error, ...extra };
}

/** Echo the given text fields back to the form after a validation error. */
export function echo(formData: FormData, fields: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return values;
}
