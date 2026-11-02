import { z } from "zod";

import { CURRENCIES } from "@/lib/money";
import {
  choice,
  optionalInt,
  optionalText,
  optionalUuid,
  requiredInt,
  requiredText,
  toMinor,
  uuidList,
} from "@/server/modules/shared/validation";

export const BUDGET_KINDS = ["not_sure", "fixed", "range", "hourly"] as const;
export const TIMELINE_KINDS = ["flexible", "asap", "weeks", "months"] as const;
export const VISIBILITIES = ["public", "invite_only"] as const;
export const PROJECT_EDITABLE = ["draft", "open"] as const;
export const MAX_PROJECT_TERMS = 10;

const amount = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().max(20).nullable());

const deadline = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "date" }).nullable(),
);

export const projectSchema = z
  .object({
    title: requiredText(5, 120),
    description: optionalText(8000),
    businessProblem: optionalText(2000),
    desiredOutcome: optionalText(2000),
    category: optionalUuid(),
    budgetKind: choice(BUDGET_KINDS),
    currency: choice(CURRENCIES),
    budgetMin: amount,
    budgetMax: amount,
    timelineKind: choice(TIMELINE_KINDS),
    deadline,
    visibility: choice(VISIBILITIES),
    terms: uuidList(MAX_PROJECT_TERMS),
  })
  .transform((input, ctx) => {
    const usesMin = input.budgetKind === "range";
    const usesMax = input.budgetKind !== "not_sure";
    const budgetMinMinor = usesMin ? toMinor(input.budgetMin, input.currency, ctx, "budgetMin") : null;
    const budgetMaxMinor = usesMax ? toMinor(input.budgetMax, input.currency, ctx, "budgetMax") : null;
    if (budgetMinMinor && budgetMaxMinor && budgetMaxMinor < budgetMinMinor) {
      ctx.addIssue({ code: "custom", message: "amount", path: ["budgetMax"] });
    }
    return { ...input, budgetMinMinor, budgetMaxMinor };
  });

export const PROJECT_FIELDS = [
  "title", "description", "businessProblem", "desiredOutcome", "category", "budgetKind", "currency", "budgetMin",
  "budgetMax", "timelineKind", "deadline", "visibility",
] as const;

export const PROPOSAL_PRICING = ["fixed", "hourly_block"] as const;

export const proposalSchema = z
  .object({
    proposedSolution: optionalText(8000),
    relevantExperience: optionalText(3000),
    questions: optionalText(2000),
    conditions: optionalText(2000),
    pricingModel: choice(PROPOSAL_PRICING),
    price: amount,
    hours: optionalInt(1, 2000),
    estimatedDays: optionalInt(1, 730),
    revisionsIncluded: optionalInt(0, 20),
    paymentModel: choice(["full", "deposit"] as const),
    depositBps: z.preprocess((v) => (typeof v === "string" && v !== "" ? Number(v) : null), z.number().int().min(1000).max(9000).nullable()),
    balanceTrigger: z.preprocess(
      (v) => (typeof v === "string" && v !== "" ? v : null),
      z.enum(["on_milestone_acceptance", "before_final_delivery"], { error: "choice" }).nullable(),
    ),
    currency: choice(CURRENCIES),
  })
  .transform((input, ctx) => {
    const priceMinor = toMinor(input.price, input.currency, ctx, "price");
    if (input.pricingModel === "hourly_block" && input.hours === null) {
      ctx.addIssue({ code: "custom", message: "required", path: ["hours"] });
    }
    if (input.paymentModel === "deposit") {
      if (input.depositBps === null) ctx.addIssue({ code: "custom", message: "required", path: ["depositBps"] });
      if (input.balanceTrigger === null) ctx.addIssue({ code: "custom", message: "required", path: ["balanceTrigger"] });
    }
    return { ...input, priceMinor };
  });

export const PROPOSAL_FIELDS = [
  "proposedSolution", "relevantExperience", "questions", "conditions", "pricingModel", "price", "hours", "estimatedDays",
  "revisionsIncluded", "paymentModel", "depositBps", "balanceTrigger",
] as const;

export const milestoneSchema = z.object({
  seq: requiredInt(1, 10),
  title: requiredText(1, 120),
  description: optionalText(1000),
  amount,
  dueOffsetDays: requiredInt(1, 730),
});

export const MILESTONE_FIELDS = ["seq", "title", "description", "amount", "dueOffsetDays"] as const;

export const deliverableSchema = z.object({ title: requiredText(1, 160) });

export const inviteSchema = z.object({
  handle: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase().replace(/^@/, "").replace(/^.*\/experts\//, "") : v),
    z.string().regex(/^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/, { error: "handle" }),
  ),
  message: optionalText(1000),
});

export const declineSchema = z.object({ reason: optionalText(1000) });

