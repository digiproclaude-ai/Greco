import { z } from "zod";

import { optionalText } from "@/server/modules/shared/validation";

export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_MESSAGE_FILES = 5;

export const messageSchema = z.object({ body: optionalText(MAX_MESSAGE_LENGTH) });

export const REPORT_REASONS = [
  "spam",
  "scam_or_fraud",
  "off_platform",
  "harassment",
  "inappropriate",
  "intellectual_property",
  "misleading",
  "prohibited_service",
  "other",
] as const;

export const REPORT_TARGETS = ["message", "user", "provider", "listing", "project", "proposal", "portfolio_item"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const reportSchema = z.object({
  reason: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.enum(REPORT_REASONS, { error: "choice" })),
  details: optionalText(2000),
});

/** Token the database puts where it hid contact details (A-13). */
export const CONTACT_HIDDEN_TOKEN = "[[contact-hidden]]";
