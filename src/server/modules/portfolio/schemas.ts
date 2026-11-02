import { z } from "zod";

import {
  choice,
  optionalHttpsUrl,
  optionalText,
  optionalUuid,
  requiredText,
  uuidList,
} from "@/server/modules/shared/validation";

export const PORTFOLIO_STATUSES = ["published", "draft", "hidden"] as const;
export const MAX_PORTFOLIO_TERMS = 10;
export const MAX_PORTFOLIO_IMAGES = 8;

const projectMonth = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null),
  z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "date" })
    .refine((value) => Number(value.slice(0, 4)) >= 1990 && value <= new Date().toISOString().slice(0, 7), {
      error: "date",
    })
    .nullable(),
);

export const portfolioItemSchema = z.object({
  title: requiredText(3, 120),
  summary: optionalText(300),
  problem: optionalText(2000),
  solution: optionalText(3000),
  results: optionalText(2000),
  role: optionalText(120),
  clientName: optionalText(120),
  industry: optionalUuid(),
  projectMonth,
  externalUrl: optionalHttpsUrl(),
  status: choice(PORTFOLIO_STATUSES),
  terms: uuidList(MAX_PORTFOLIO_TERMS),
});

export const PORTFOLIO_FIELDS = [
  "title", "summary", "problem", "solution", "results", "role", "clientName", "industry", "projectMonth",
  "externalUrl", "status",
] as const;

export const captionSchema = z.object({ caption: optionalText(200) });
