import { describe, expect, it } from "vitest";

import { basicsSchema, paymentSchema, pricingSchema, requirementSchema, slugify } from "@/server/modules/catalog/schemas";
import { clientProfileSchema } from "@/server/modules/clients/schemas";
import { handleSchema, profileSchema } from "@/server/modules/providers/schemas";
import { toFieldErrors } from "@/server/modules/shared/validation";

const errorsOf = (result: { success: boolean; error?: unknown }) =>
  result.success ? {} : toFieldErrors(result.error as Parameters<typeof toFieldErrors>[0]);

describe("listing schemas", () => {
  it("slugify titles", () => {
    expect(slugify("AI Receptionist for Clinics!")).toBe("ai-receptionist-for-clinics");
    expect(slugify("Ünïcödé — chatbots")).toBe("unicode-chatbots");
    expect(slugify("!!!")).toBe("service");
  });

  it("require a price and delivery time for fixed pricing and convert to minor units", () => {
    const missing = pricingSchema.safeParse({ pricingModel: "fixed", currency: "USD", fixedPrice: "", baseDeliveryDays: "" });
    expect(errorsOf(missing)).toMatchObject({ fixedPrice: { key: "required" }, baseDeliveryDays: { key: "required" } });

    const ok = pricingSchema.parse({ pricingModel: "fixed", currency: "EUR", fixedPrice: "1,200.50", baseDeliveryDays: "10" });
    expect(ok.fixedPriceMinor).toBe(120050);
    expect(ok.hourlyRateMinor).toBeNull();
  });

  it("reject malformed amounts", () => {
    const bad = pricingSchema.safeParse({ pricingModel: "fixed", currency: "USD", fixedPrice: "12.345", baseDeliveryDays: "3" });
    expect(errorsOf(bad)).toMatchObject({ fixedPrice: { key: "amount" } });
  });

  it("require deposit details only for the deposit model", () => {
    expect(paymentSchema.safeParse({ paymentModel: "full" }).success).toBe(true);
    expect(errorsOf(paymentSchema.safeParse({ paymentModel: "deposit" }))).toMatchObject({
      depositBps: { key: "required" },
      balanceTrigger: { key: "required" },
    });
    expect(paymentSchema.parse({ paymentModel: "deposit", depositBps: "3000", balanceTrigger: "before_final_delivery" }).depositBps).toBe(3000);
  });

  it("need at least two options for choice questions", () => {
    const result = requirementSchema.safeParse({ prompt: "Which plan do you use?", inputType: "choice", options: "Only one" });
    expect(errorsOf(result)).toMatchObject({ options: { key: "tooFew", values: { min: 2 } } });
    expect(requirementSchema.parse({ prompt: "Your website?", inputType: "url", isRequired: "on" }).isRequired).toBe(true);
  });

  it("validate slugs and keep the secondary category different", () => {
    const result = basicsSchema.safeParse({
      title: "AI receptionist",
      slug: "Bad Slug",
      primaryCategory: "6f1c5c8e-1d1b-4a5f-9a43-2f2a2b2c2d2e",
      secondaryCategory: "6f1c5c8e-1d1b-4a5f-9a43-2f2a2b2c2d2e",
      terms: [],
    });
    expect(errorsOf(result)).toMatchObject({ slug: { key: "slug" }, secondaryCategory: { key: "choice" } });
  });
});

describe("profile schemas", () => {
  it("accept valid handles and reject bad ones", () => {
    expect(handleSchema.safeParse({ handle: "Voice-Labs" }).success).toBe(true);
    expect(handleSchema.parse({ handle: " Voice-Labs " }).handle).toBe("voice-labs");
    for (const handle of ["ab", "-start", "end-", "double--hyphen", "has space"]) {
      expect(handleSchema.safeParse({ handle }).success).toBe(false);
    }
  });

  it("convert the indicative rate and validate the website", () => {
    const base = { providerType: "individual", displayName: "Ana Expert", timezone: "Europe/Bucharest", availability: "available", rateCurrency: "EUR" };
    expect(profileSchema.parse({ ...base, rate: "85" }).rateMinor).toBe(8500);
    expect(profileSchema.parse({ ...base, rate: "" }).rateMinor).toBeNull();
    expect(errorsOf(profileSchema.safeParse({ ...base, website: "http://insecure.example" }))).toMatchObject({ website: { key: "url" } });
    expect(errorsOf(profileSchema.safeParse({ ...base, timezone: "Mars/Olympus" }))).toMatchObject({ timezone: { key: "choice" } });
  });

  it("require a business name for business clients", () => {
    expect(errorsOf(clientProfileSchema.safeParse({ accountType: "business" }))).toMatchObject({ businessName: { key: "required" } });
    expect(clientProfileSchema.safeParse({ accountType: "individual" }).success).toBe(true);
  });

  it("report length limits with their values", () => {
    const result = profileSchema.safeParse({
      providerType: "individual",
      displayName: "A",
      headline: "x".repeat(121),
      timezone: "UTC",
      availability: "available",
      rateCurrency: "USD",
    });
    expect(errorsOf(result)).toMatchObject({
      displayName: { key: "tooShort", values: { min: 2 } },
      headline: { key: "tooLong", values: { max: 120 } },
    });
  });
});
