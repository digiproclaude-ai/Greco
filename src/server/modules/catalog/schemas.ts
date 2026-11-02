import { z } from "zod";

import { CURRENCIES } from "@/lib/money";
import {
  checkbox,
  choice,
  msg,
  optionalInt,
  optionalText,
  optionalUuid,
  requiredInt,
  requiredText,
  toMinor,
  uuidList,
} from "@/server/modules/shared/validation";

export const PRICING_MODELS = ["packages", "fixed", "hourly", "quote"] as const;
export const PAYMENT_MODELS = ["full", "deposit"] as const;
export const BALANCE_TRIGGERS = ["on_milestone_acceptance", "before_final_delivery"] as const;
export const REQUIREMENT_TYPES = ["long_text", "text", "url", "choice", "multi_choice"] as const;
export const EDITABLE_STATUSES = ["draft", "rejected", "published", "paused"] as const;

export const LISTING_LIMITS = {
  terms: 15,
  packages: 3,
  deliverables: 30,
  addons: 10,
  requirements: 15,
  faqs: 15,
  media: 8,
} as const;

const amount = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().max(20).nullable());

export const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "") || "service";

export const newListingSchema = z.object({
  title: requiredText(3, 100),
  primaryCategory: optionalUuid(),
});

export const basicsSchema = z
  .object({
    title: requiredText(3, 100),
    slug: z.preprocess(
      (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
      z
        .string({ error: "required" })
        .min(1, { error: "required" })
        .max(80, { error: msg("tooLong", { max: 80 }) })
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "slug" }),
    ),
    summary: optionalText(200),
    description: optionalText(8000),
    primaryCategory: optionalUuid(),
    secondaryCategory: optionalUuid(),
    terms: uuidList(LISTING_LIMITS.terms),
  })
  .superRefine((input, ctx) => {
    if (input.secondaryCategory && input.secondaryCategory === input.primaryCategory) {
      ctx.addIssue({ code: "custom", message: "choice", path: ["secondaryCategory"] });
    }
  });

export const BASICS_FIELDS = ["title", "slug", "summary", "description", "primaryCategory", "secondaryCategory"] as const;

export const pricingSchema = z
  .object({
    pricingModel: choice(PRICING_MODELS),
    currency: choice(CURRENCIES),
    fixedPrice: amount,
    hourlyRate: amount,
    minHours: optionalInt(1, 1000),
    quoteFrom: amount,
    baseDeliveryDays: optionalInt(1, 365),
    revisionsIncluded: optionalInt(0, 20),
    revisionPolicy: optionalText(1000),
  })
  .transform((input, ctx) => {
    const fixedPriceMinor = input.pricingModel === "fixed" ? toMinor(input.fixedPrice, input.currency, ctx, "fixedPrice") : null;
    const hourlyRateMinor = input.pricingModel === "hourly" ? toMinor(input.hourlyRate, input.currency, ctx, "hourlyRate") : null;
    const quoteFromMinor = input.pricingModel === "quote" ? toMinor(input.quoteFrom, input.currency, ctx, "quoteFrom") : null;
    if (input.pricingModel === "fixed" && !input.fixedPrice) ctx.addIssue({ code: "custom", message: "required", path: ["fixedPrice"] });
    if (input.pricingModel === "hourly" && !input.hourlyRate) ctx.addIssue({ code: "custom", message: "required", path: ["hourlyRate"] });
    if (input.pricingModel === "hourly" && input.minHours === null) ctx.addIssue({ code: "custom", message: "required", path: ["minHours"] });
    if ((input.pricingModel === "fixed" || input.pricingModel === "hourly") && input.baseDeliveryDays === null) {
      ctx.addIssue({ code: "custom", message: "required", path: ["baseDeliveryDays"] });
    }
    return { ...input, fixedPriceMinor, hourlyRateMinor, quoteFromMinor };
  });

export const PRICING_FIELDS = [
  "pricingModel", "currency", "fixedPrice", "hourlyRate", "minHours", "quoteFrom", "baseDeliveryDays",
  "revisionsIncluded", "revisionPolicy",
] as const;

export const paymentSchema = z
  .object({
    paymentModel: choice(PAYMENT_MODELS),
    depositBps: z.preprocess(
      (value) => (typeof value === "string" && value !== "" ? Number(value) : null),
      z.number().int().min(1000).max(9000).nullable(),
    ),
    balanceTrigger: z.preprocess(
      (value) => (typeof value === "string" && value !== "" ? value : null),
      z.enum(BALANCE_TRIGGERS, { error: "choice" }).nullable(),
    ),
  })
  .superRefine((input, ctx) => {
    if (input.paymentModel === "deposit") {
      if (input.depositBps === null) ctx.addIssue({ code: "custom", message: "required", path: ["depositBps"] });
      if (input.balanceTrigger === null) ctx.addIssue({ code: "custom", message: "required", path: ["balanceTrigger"] });
    }
  });

export const packageSchema = z.object({
  tier: requiredInt(1, 3),
  name: requiredText(1, 40),
  description: optionalText(500),
  price: amount,
  deliveryDays: requiredInt(1, 365),
  revisions: requiredInt(0, 20),
});

export const PACKAGE_FIELDS = ["tier", "name", "description", "price", "deliveryDays", "revisions"] as const;

export const deliverableSchema = z.object({
  title: requiredText(1, 160),
  packageId: optionalUuid(),
});

export const addonSchema = z.object({
  title: requiredText(1, 120),
  description: optionalText(500),
  price: amount,
  extraDays: optionalInt(0, 180),
});

export const ADDON_FIELDS = ["title", "description", "price", "extraDays"] as const;

export const requirementSchema = z
  .object({
    prompt: requiredText(3, 300),
    inputType: choice(REQUIREMENT_TYPES),
    options: z.preprocess(
      (value) =>
        typeof value === "string"
          ? value
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
      z.array(z.string().max(80, { error: msg("tooLong", { max: 80 }) })).max(12, { error: msg("tooMany", { max: 12 }) }),
    ),
    isRequired: checkbox(),
  })
  .superRefine((input, ctx) => {
    if ((input.inputType === "choice" || input.inputType === "multi_choice") && input.options.length < 2) {
      ctx.addIssue({ code: "custom", message: msg("tooFew", { min: 2 }), path: ["options"] });
    }
  });

export const REQUIREMENT_FIELDS = ["prompt", "inputType", "options"] as const;

export const faqSchema = z.object({
  question: requiredText(3, 200),
  answer: requiredText(1, 1500),
});

export const altTextSchema = z.object({ alt: requiredText(1, 200) });
