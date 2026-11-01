import { z } from "zod";

import type { Messages } from "@/i18n/messages";

export type ValidationKey = keyof Messages["validation"];
export type FieldError = { key: ValidationKey; values?: Record<string, string | number> };

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72; // bcrypt limit used by Supabase Auth
export const NAME_MIN = 2;
export const NAME_MAX = 120;

const email = z
  .string({ error: "email" })
  .trim()
  .toLowerCase()
  .max(254, { error: "email" })
  .pipe(z.email({ error: "email" }));
const password = z
  .string({ error: "required" })
  .min(PASSWORD_MIN, { error: "passwordMin" })
  .max(PASSWORD_MAX, { error: "passwordMax" });

export const registerSchema = z.object({
  fullName: z.string({ error: "required" }).trim().min(NAME_MIN, { error: "nameLength" }).max(NAME_MAX, { error: "nameLength" }),
  email,
  password,
  country: z.string({ error: "country" }).regex(/^[A-Z]{2}$/, { error: "country" }),
  role: z.enum(["client", "expert"], { error: "role" }),
  legal: z.literal("on", { error: "legal" }),
});

export const loginSchema = z.object({
  email,
  password: z.string({ error: "required" }).min(1, { error: "required" }).max(PASSWORD_MAX, { error: "passwordMax" }),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirm: z.string({ error: "required" }) })
  .refine((value) => value.password === value.confirm, { error: "passwordMismatch", path: ["confirm"] });

export const mfaCodeSchema = z.object({
  code: z.string({ error: "code" }).trim().regex(/^\d{6}$/, { error: "code" }),
  next: z.string().optional(),
});

export const googleSignupSchema = z.object({
  role: z.enum(["client", "expert"], { error: "role" }),
  legal: z.literal("on", { error: "legal" }),
});

const VALUES: Partial<Record<ValidationKey, Record<string, number>>> = {
  passwordMin: { min: PASSWORD_MIN },
  passwordMax: { max: PASSWORD_MAX },
  nameLength: { min: NAME_MIN, max: NAME_MAX },
};

/** Convert a Zod error into one translatable error per field. */
export function toFieldErrors(error: z.ZodError): Record<string, FieldError> {
  const result: Record<string, FieldError> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (result[field]) continue;
    const key: ValidationKey = isValidationKey(issue.message) ? issue.message : "required";
    result[field] = { key, values: VALUES[key] };
  }
  return result;
}

const VALIDATION_KEYS: readonly string[] = [
  "required", "email", "passwordMin", "passwordMax", "passwordMismatch", "nameLength", "country", "role", "legal", "code",
] satisfies readonly ValidationKey[];

function isValidationKey(value: string): value is ValidationKey {
  return VALIDATION_KEYS.includes(value);
}
