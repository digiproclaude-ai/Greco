import { z } from "zod";

import { CURRENCIES } from "@/lib/money";
import { LANGUAGE_CODES } from "@/lib/languages";
import {
  choice,
  msg,
  optionalChoice,
  optionalHttpsUrl,
  optionalInt,
  optionalText,
  requiredHttpsUrl,
  requiredText,
  toMinor,
  uuidList,
} from "@/server/modules/shared/validation";

export const PROVIDER_TYPES = ["individual", "agency"] as const;
export const EXPERIENCE_LEVELS = ["emerging", "established", "expert"] as const;
export const AVAILABILITY = ["available", "limited", "unavailable"] as const;
export const TEAM_SIZES = ["2-5", "6-10", "11-25", "26-50", "51-200", "200+"] as const;
export const PROFICIENCIES = ["basic", "conversational", "fluent", "native"] as const;
export const LINK_KINDS = ["website", "github", "linkedin", "huggingface", "kaggle", "x", "youtube", "scholar", "other"] as const;

export const MAX_PROVIDER_TERMS = 20;
export const MIN_PROVIDER_TERMS = 3;
export const MAX_LANGUAGES = 10;
export const MAX_LINKS = 8;

const timezone = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().min(1, { error: "required" }).max(64).refine((zone) => zone === "UTC" || isTimeZone(zone), { error: "choice" }),
);

function isTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export const profileSchema = z
  .object({
    providerType: choice(PROVIDER_TYPES),
    displayName: requiredText(2, 80),
    headline: optionalText(120),
    bio: optionalText(5000),
    country: z.preprocess(
      (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null),
      z.string().regex(/^[A-Z]{2}$/, { error: "country" }).nullable(),
    ),
    city: optionalText(80),
    timezone,
    experienceLevel: optionalChoice(EXPERIENCE_LEVELS),
    yearsExperience: optionalInt(0, 60),
    availability: choice(AVAILABILITY),
    availabilityNote: optionalText(200),
    rate: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().max(20).nullable()),
    rateCurrency: choice(CURRENCIES),
    website: optionalHttpsUrl(),
  })
  .transform((input, ctx) => ({ ...input, rateMinor: toMinor(input.rate, input.rateCurrency, ctx, "rate") }));

export const PROFILE_FIELDS = [
  "providerType", "displayName", "headline", "bio", "country", "city", "timezone", "experienceLevel",
  "yearsExperience", "availability", "availabilityNote", "rate", "rateCurrency", "website",
] as const;

export const handleSchema = z.object({
  handle: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z
      .string({ error: "required" })
      .regex(/^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/, { error: "handle" })
      .refine((value) => !value.includes("--"), { error: "handle" }),
  ),
});

const currentYear = new Date().getUTCFullYear();

export const agencySchema = z.object({
  foundedYear: optionalInt(1950, currentYear),
  teamSize: optionalChoice(TEAM_SIZES),
  offices: z.preprocess(
    (value) =>
      typeof value === "string"
        ? value
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    z.array(z.string().max(80, { error: msg("tooLong", { max: 80 }) })).max(10, { error: msg("tooMany", { max: 10 }) }),
  ),
  legalName: optionalText(160),
  registrationNumber: optionalText(64),
});

export const AGENCY_FIELDS = ["foundedYear", "teamSize", "offices", "legalName", "registrationNumber"] as const;

export const languageSchema = z.object({
  language: choice(LANGUAGE_CODES),
  proficiency: choice(PROFICIENCIES),
});

export const linkSchema = z.object({
  kind: choice(LINK_KINDS),
  url: requiredHttpsUrl(),
});

export const termsSchema = z.object({ terms: uuidList(MAX_PROVIDER_TERMS) });

