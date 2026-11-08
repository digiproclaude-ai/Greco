import { describe, expect, it } from "vitest";

import { inviteSchema, milestoneSchema, newProjectSchema, projectSchema, proposalSchema } from "@/server/modules/projects/schemas";

const base = {
  title: "AI phone assistant for clinics",
  description: "",
  businessProblem: "",
  desiredOutcome: "",
  category: "",
  budgetKind: "not_sure",
  currency: "USD",
  budgetMin: "",
  budgetMax: "",
  timelineKind: "flexible",
  deadline: "",
  visibility: "public",
  terms: [],
};

describe("projectSchema", () => {
  it("ignores amounts when the budget is open", () => {
    const parsed = projectSchema.parse({ ...base, budgetMax: "5000" });
    expect(parsed.budgetMaxMinor).toBeNull();
    expect(parsed.budgetMinMinor).toBeNull();
  });

  it("converts a range to minor units", () => {
    const parsed = projectSchema.parse({ ...base, budgetKind: "range", budgetMin: "2,000", budgetMax: "5000.50" });
    expect(parsed.budgetMinMinor).toBe(200000);
    expect(parsed.budgetMaxMinor).toBe(500050);
  });

  it("rejects a range that ends below its start", () => {
    const result = projectSchema.safeParse({ ...base, budgetKind: "range", budgetMin: "5000", budgetMax: "100" });
    expect(result.success).toBe(false);
  });

  it("keeps only the maximum for fixed and hourly budgets", () => {
    const parsed = projectSchema.parse({ ...base, budgetKind: "hourly", budgetMin: "10", budgetMax: "120" });
    expect(parsed.budgetMinMinor).toBeNull();
    expect(parsed.budgetMaxMinor).toBe(12000);
  });

  it("validates dates and visibility", () => {
    expect(projectSchema.safeParse({ ...base, deadline: "next week" }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, visibility: "secret" }).success).toBe(false);
    expect(projectSchema.parse({ ...base, deadline: "2027-01-31" }).deadline).toBe("2027-01-31");
  });

  it("needs a real title for a new project", () => {
    expect(newProjectSchema.safeParse({ title: "AI", category: "" }).success).toBe(false);
    expect(newProjectSchema.parse({ title: "Chatbot for our shop", category: "" }).category).toBeNull();
  });
});

const proposal = {
  proposedSolution: "x".repeat(120),
  relevantExperience: "",
  questions: "",
  conditions: "",
  pricingModel: "fixed",
  price: "1500",
  hours: "",
  estimatedDays: "14",
  revisionsIncluded: "2",
  paymentModel: "full",
  depositBps: "",
  balanceTrigger: "",
  currency: "EUR",
};

describe("proposalSchema", () => {
  it("converts the price", () => {
    expect(proposalSchema.parse(proposal).priceMinor).toBe(150000);
  });

  it("requires hours for a block of hours", () => {
    const result = proposalSchema.safeParse({ ...proposal, pricingModel: "hourly_block" });
    expect(result.success).toBe(false);
    expect(proposalSchema.parse({ ...proposal, pricingModel: "hourly_block", hours: "20" }).hours).toBe(20);
  });

  it("requires a deposit and a balance trigger for deposits", () => {
    expect(proposalSchema.safeParse({ ...proposal, paymentModel: "deposit" }).success).toBe(false);
    const parsed = proposalSchema.parse({ ...proposal, paymentModel: "deposit", depositBps: "3000", balanceTrigger: "before_final_delivery" });
    expect(parsed.depositBps).toBe(3000);
  });

  it("rejects invalid amounts", () => {
    expect(proposalSchema.safeParse({ ...proposal, price: "12.345" }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...proposal, price: "-5" }).success).toBe(false);
  });
});

describe("milestoneSchema", () => {
  it("needs a title and a due day", () => {
    expect(milestoneSchema.safeParse({ title: "", amount: "100", dueOffsetDays: "7" }).success).toBe(false);
    expect(milestoneSchema.safeParse({ title: "Prototype", amount: "100", dueOffsetDays: "" }).success).toBe(false);
    expect(milestoneSchema.parse({ title: "Prototype", amount: "100", dueOffsetDays: "7" }).dueOffsetDays).toBe(7);
  });
});

describe("inviteSchema", () => {
  it("accepts a handle, an @handle or a profile URL", () => {
    expect(inviteSchema.parse({ handle: "ada-lovelace", message: "" }).handle).toBe("ada-lovelace");
    expect(inviteSchema.parse({ handle: "@Ada-Lovelace", message: "" }).handle).toBe("ada-lovelace");
    expect(inviteSchema.parse({ handle: "https://greco.ai/experts/ada-lovelace", message: "" }).handle).toBe("ada-lovelace");
  });

  it("rejects anything else", () => {
    expect(inviteSchema.safeParse({ handle: "ada lovelace", message: "" }).success).toBe(false);
    expect(inviteSchema.safeParse({ handle: "-x", message: "" }).success).toBe(false);
  });
});
