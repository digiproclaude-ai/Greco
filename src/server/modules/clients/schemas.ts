import { z } from "zod";

import { choice, optionalChoice, optionalHttpsUrl, optionalText, optionalUuid } from "@/server/modules/shared/validation";

export const ACCOUNT_TYPES = ["individual", "business"] as const;
export const COMPANY_SIZES = ["1", "2-10", "11-50", "51-200", "201-1000", "1000+"] as const;

export const clientProfileSchema = z
  .object({
    accountType: choice(ACCOUNT_TYPES),
    businessName: optionalText(160),
    industry: optionalUuid(),
    companySize: optionalChoice(COMPANY_SIZES),
    website: optionalHttpsUrl(),
    purpose: optionalText(500),
    challenges: optionalText(2000),
  })
  .superRefine((input, ctx) => {
    if (input.accountType === "business" && !input.businessName) {
      ctx.addIssue({ code: "custom", message: "required", path: ["businessName"] });
    }
  });

export const CLIENT_FIELDS = ["accountType", "businessName", "industry", "companySize", "website", "purpose", "challenges"] as const;
