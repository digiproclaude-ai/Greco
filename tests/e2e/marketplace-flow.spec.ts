import { expect, test } from "@playwright/test";

import { signUp, sql, totp } from "./helpers";

/*
 * Expert onboarding -> moderation -> public search, against a local Supabase stack.
 * Skipped unless E2E_SUPABASE=1. Staff rights are granted directly in the database (there is
 * no self-service way to become staff), and the TOTP code is computed here.
 */
test.skip(process.env.E2E_SUPABASE !== "1", "needs a local Supabase stack (E2E_SUPABASE=1)");

test("an expert's profile and service go live after moderation and appear in search", async ({ browser }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const serviceTitle = `AI receptionist that answers and books calls ${stamp}`;

  // 1. The expert completes the profile and submits it.
  const expertContext = await browser.newContext();
  const expert = await expertContext.newPage();
  await signUp(expert, { email: `expert-${stamp}@greco.test`, name: "Vera Voice", role: "expert" });

  await expert.goto("/dashboard/expert/profile");
  const basics = expert.locator("#basics");
  await basics.getByLabel("Headline").fill("Voice agents for clinics and service businesses");
  await basics.getByLabel("About", { exact: true }).fill(
    "I design and run AI voice agents that answer calls, book appointments into your calendar and hand over to your team when a human is needed. Eight years in telephony.",
  );
  await basics.getByLabel("Country").selectOption("RO");
  await basics.getByLabel("Experience level").selectOption("expert");
  await basics.getByRole("button", { name: "Save changes" }).click();
  await expect(basics.getByText("Saved.")).toBeVisible();

  const skills = expert.locator("#skills");
  for (const name of ["Voice AI", "Prompt engineering", "AI agent design"]) {
    await skills.getByRole("checkbox", { name, exact: true }).check();
  }
  await skills.getByRole("button", { name: "Save changes" }).click();
  await expect(skills.getByText("Saved.")).toBeVisible();

  const languages = expert.locator("#languages");
  await languages.getByLabel("Language").selectOption("en");
  await languages.getByRole("button", { name: "Add language" }).click();
  await expect(languages.getByText("English")).toBeVisible();

  const handle = await expert.locator("#address").getByLabel("Profile address").inputValue();
  await expert.locator("#status").getByRole("button", { name: "Submit profile for review" }).click();
  // The page refreshes into the "in review" state (the submit form is no longer shown).
  await expect(expert.getByText("Greco is reviewing your profile.", { exact: false })).toBeVisible();

  // 2. The expert creates a service and submits it.
  await expert.goto("/dashboard/expert/services/new");
  await expert.getByLabel("Title").fill(serviceTitle);
  await expert.getByLabel("Category").selectOption({ label: "Voice agents & phone automation › AI receptionists" });
  await expert.getByRole("button", { name: "Create draft" }).click();
  await expect(expert).toHaveURL(/\/dashboard\/expert\/services\/[0-9a-f-]{36}$/);

  const listingBasics = expert.locator("#basics");
  await listingBasics.getByLabel("Summary").fill("An AI receptionist that answers every call, books appointments and never puts callers on hold.");
  await listingBasics.getByLabel("Description").fill(
    "I set up an AI receptionist for your business phone line. It answers calls in a natural voice, books and reschedules appointments in your calendar, answers common questions from your own information, and transfers to your team when needed. You get call summaries and a dashboard.",
  );
  await listingBasics.getByRole("checkbox", { name: "Voice AI", exact: true }).check();
  await listingBasics.getByRole("button", { name: "Save changes" }).click();
  await expect(listingBasics.getByText("Saved.")).toBeVisible();

  const pricing = expert.locator("#pricing");
  await pricing.getByRole("radio", { name: /Fixed price/ }).click();
  await pricing.getByLabel("Price").fill("450");
  await pricing.getByLabel("Delivery time (days)").fill("7");
  await pricing.getByRole("button", { name: "Save changes" }).click();
  await expect(pricing.getByText("Saved.")).toBeVisible();

  await expert.locator("#status").getByRole("button", { name: "Submit for review" }).click();
  await expect(expert.getByText("This service is in review, so it can't be edited right now.")).toBeVisible();

  // 3. A moderator with two-step verification approves both.
  const staffEmail = `staff-${stamp}@greco.test`;
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await signUp(staff, { email: staffEmail, name: "Mo Moderator", role: "client" });
  sql(`insert into public.staff_roles (user_id, role) select id, 'admin' from auth.users where email = '${staffEmail}'`);

  await staff.goto("/dashboard/settings/security");
  await staff.getByRole("button", { name: "Set up two-step verification" }).click();
  const secret = (await staff.locator("code").first().textContent())!.trim();
  await staff.getByLabel("Code from the app").fill(totp(secret));
  await staff.getByRole("button", { name: "Turn on" }).click();
  await expect(staff.getByText("Two-step verification is on.")).toBeVisible();

  for (let i = 0; i < 2; i += 1) {
    await staff.goto("/admin/moderation");
    await staff.getByRole("link", { name: "Review" }).first().click();
    await staff.getByRole("button", { name: "Approve and publish" }).click();
    await expect(staff).toHaveURL(/\/admin\/moderation$/);
  }
  await expect(staff.getByText("Nothing waiting for review.")).toBeVisible();

  // 4. Anyone can now find the service and the expert.
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(`/search?q=${encodeURIComponent("receptionist")}`);
  await expect(visitor.getByRole("link", { name: serviceTitle })).toBeVisible();
  await visitor.getByRole("link", { name: serviceTitle }).click();
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(serviceTitle);
  await expect(visitor.getByText("You pay the full price before work starts.")).toBeVisible();

  await visitor.goto(`/experts/${handle}`);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Vera Voice");
  await expect(visitor.getByText("Voice AI").first()).toBeVisible();

  await Promise.all([expertContext.close(), staffContext.close(), visitorContext.close()]);
});
