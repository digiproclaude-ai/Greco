import { z } from "zod";

import type { FieldError, ValidationKey } from "@/server/modules/identity/schemas";
import { parseMoneyToMinor } from "@/lib/money";

/**
 * Zod helpers for FormData. Messages are validation keys; values for interpolation travel in
 * the message as "key|{json}" and are unpacked by toFieldErrors.
 */
export function msg(key: ValidationKey, values?: Record<string, number>): string {
  return values ? `${key}|${JSON.stringify(values)}` : key;
}

const trimmedOrNull = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const trimmedOrEmpty = (value: unknown) => (typeof value === "string" ? value.trim() : (value ?? ""));

export const requiredText = (min: number, max: number) =>
  z.preprocess(
    trimmedOrEmpty,
    z
      .string({ error: "required" })
      .min(1, { error: "required" })
      .min(min, { error: msg("tooShort", { min }) })
      .max(max, { error: msg("tooLong", { max }) }),
  );

export const optionalText = (max: number) =>
  z.preprocess(trimmedOrNull, z.string().max(max, { error: msg("tooLong", { max }) }).nullable());

export const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      const trimmed = trimmedOrNull(value);
      return trimmed === null ? null : Number(trimmed);
    },
    z
      .number({ error: "number" })
      .int({ error: "number" })
      .min(min, { error: msg("range", { min, max }) })
      .max(max, { error: msg("range", { min, max }) })
      .nullable(),
  );

export const requiredInt = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      const trimmed = trimmedOrNull(value);
      return trimmed === null ? undefined : Number(trimmed);
    },
    z
      .number({ error: "required" })
      .int({ error: "number" })
      .min(min, { error: msg("range", { min, max }) })
      .max(max, { error: msg("range", { min, max }) }),
  );

const HTTPS_URL = /^https:\/\/[^\s]+$/i;

export const optionalHttpsUrl = (max = 300) =>
  z.preprocess(
    trimmedOrNull,
    z
      .string()
      .max(max, { error: msg("tooLong", { max }) })
      .regex(HTTPS_URL, { error: "url" })
      .refine((value) => URL.canParse(value), { error: "url" })
      .nullable(),
  );

export const requiredHttpsUrl = (max = 300) =>
  z.preprocess(
    trimmedOrEmpty,
    z
      .string()
      .min(1, { error: "required" })
      .max(max, { error: msg("tooLong", { max }) })
      .regex(HTTPS_URL, { error: "url" })
      .refine((value) => URL.canParse(value), { error: "url" }),
  );

export const choice = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(trimmedOrEmpty, z.enum(values, { error: "choice" }));

export const optionalChoice = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(trimmedOrNull, z.enum(values, { error: "choice" }).nullable());

export const uuid = () => z.preprocess(trimmedOrEmpty, z.uuid({ error: "choice" }));
export const optionalUuid = () => z.preprocess(trimmedOrNull, z.uuid({ error: "choice" }).nullable());

export const checkbox = () => z.preprocess((value) => value === "on" || value === "true" || value === "1", z.boolean());

/** A list of UUIDs submitted as repeated form fields (formData.getAll). */
export const uuidList = (max: number) =>
  z.array(z.uuid({ error: "choice" })).max(max, { error: msg("tooMany", { max }) });

/** An amount typed by the user; converted to minor units with the given currency. */
export const amountText = () =>
  z.preprocess(trimmedOrEmpty, z.string().min(1, { error: "required" }).max(20, { error: "amount" }));

export function toMinor(amount: string | null | undefined, currency: string, ctx: z.RefinementCtx, path: string) {
  if (amount === null || amount === undefined || amount === "") return null;
  const minor = parseMoneyToMinor(amount, currency);
  if (minor === null || minor <= 0) {
    ctx.addIssue({ code: "custom", message: "amount", path: [path] });
    return null;
  }
  return minor;
}

/** Convert a Zod error into one translatable error per field. */
export function toFieldErrors(error: z.ZodError): Record<string, FieldError> {
  const result: Record<string, FieldError> = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".") || "form";
    if (result[field]) continue;
    result[field] = issueToFieldError(issue);
  }
  return result;
}

function issueToFieldError(issue: z.core.$ZodIssue): FieldError {
  const [key, json] = issue.message.split("|", 2);
  if (key && isValidationKey(key)) {
    return json ? { key, values: JSON.parse(json) as Record<string, number> } : { key };
  }
  switch (issue.code) {
    case "too_small":
      return Number(issue.minimum) <= 1 ? { key: "required" } : { key: "tooShort", values: { min: Number(issue.minimum) } };
    case "too_big":
      return { key: "tooLong", values: { max: Number(issue.maximum) } };
    case "invalid_value":
      return { key: "choice" };
    default:
      return { key: "required" };
  }
}

const KEYS: readonly string[] = [
  "required", "email", "passwordMin", "passwordMax", "passwordMismatch", "nameLength", "country", "role",
  "legal", "code", "tooShort", "tooLong", "url", "number", "range", "amount", "choice", "handle", "slug",
  "date", "tooMany", "tooFew", "file",
] satisfies readonly ValidationKey[];

function isValidationKey(value: string): value is ValidationKey {
  return KEYS.includes(value);
}
