import type { AuthErrorKey } from "./auth-errors";
import type { FieldError } from "./schemas";

/** Result returned by auth Server Actions to their forms (via useActionState). */
export type FormState = {
  status: "idle" | "error" | "success";
  error?: AuthErrorKey;
  fieldErrors?: Record<string, FieldError>;
  /** Non-secret values echoed back so the form keeps what the user typed. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };
