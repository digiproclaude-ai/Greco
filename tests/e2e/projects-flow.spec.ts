import { expect, test, type Page } from "@playwright/test";

import { signUp, sql } from "./helpers";

/*
 * Phase 4: a client posts a project, an approved expert sends a proposal, the client
 * shortlists it and messages the expert (contact details are hidden), and the expert replies.
 * Skipped unless E2E_SUPABASE=1. The expert's profile is approved directly in the database:
 * moderation itself is covered by marketplace-flow.spec.ts.
 */
test.skip(process.env.E2E_SUPABASE !== "1", "needs a local Supabase stack (E2E_SUPABASE=1)");

/** Realtime should deliver new messages; reload once if it hasn't within a few seconds. */
async function expectLiveText(page: Page, text: string) {
  const thread = page.getByRole("region", { name: /Conversation with/ });
  try {
    await expect(thread.getByText(text)).toBeVisible({ timeout: 8_000 });
  } catch {
    await page.reload();
    await expect(thread.getByText(text)).toBeVisible();
  }
}

test("a client receives a proposal, shortlists it and talks to the expert", async ({ browser }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const projectTitle = `Phone assistant for our dental clinics ${stamp}`;

  // 1. The client posts a project.
  const clientContext = await browser.newContext();
  const client = await clientContext.newPage();
  await signUp(client, { email: `client-p-${stamp}@greco.test`, name: "Cora Client", role: "client" });

  await client.goto("/dashboard/client/projects/new");
  await client.getByLabel("Project title").fill(projectTitle);
  await client.getByLabel("Category").selectOption({ label: "Voice agents & phone automation › AI receptionists" });
  await client.getByRole("button", { name: "Create draft" }).click();
  await expect(client).toHaveURL(/\/dashboard\/client\/projects\/[0-9a-f-]{36}$/);

  const details = client.locator("#details");
  await details.getByLabel("Description").fill(
    "We run three dental clinics and miss calls at lunch and after hours. We want an AI assistant that answers, books appointments in our calendar and passes urgent cases to staff.",
  );
  await details.getByLabel("Budget", { exact: true }).selectOption("fixed");
  await details.getByLabel("Up to").fill("3000");
  await details.getByRole("button", { name: "Save changes" }).click();
  await expect(details.getByText("Saved.")).toBeVisible();

  await client.locator("#status").getByRole("button", { name: "Publish project" }).click();
  await expect(client.getByText("Open until", { exact: false })).toBeVisible();

  // 2. An approved expert finds it on the board and sends a proposal.
  const expertEmail = `expert-p-${stamp}@greco.test`;
  const expertContext = await browser.newContext();
  const expert = await expertContext.newPage();
  await signUp(expert, { email: expertEmail, name: "Pat Proposal", role: "expert" });
  sql(
    `update public.providers set status = 'active', published_at = now(), display_name = 'Pat Voice Studio'
      where owner_user_id = (select id from auth.users where email = '${expertEmail}')`,
  );

  await expert.goto("/dashboard/expert/projects");
  await expert.getByRole("link", { name: projectTitle }).click();
  await expert.getByRole("button", { name: "Write a proposal" }).click();
  await expect(expert).toHaveURL(/\/dashboard\/expert\/proposals\/[0-9a-f-]{36}$/);

  const proposal = expert.locator("#details");
  await proposal.getByLabel("Proposed approach").fill(
    "I will set up a voice assistant on your existing numbers, connect it to your booking calendar, write the call scripts with your team and test it for a week before go-live.",
  );
  await proposal.getByLabel("Price (USD)").fill("2400");
  await proposal.getByLabel("Estimated days to deliver").fill("21");
  await proposal.getByRole("button", { name: "Save changes" }).click();
  await expect(proposal.getByText("Saved.")).toBeVisible();
  await expect(proposal.getByText("you receive $2,040.00 after Greco's 15% commission", { exact: false })).toBeVisible();

  await expert.locator("#status").getByRole("button", { name: "Send proposal" }).click();
  await expect(expert.getByText("Sent proposals can't be edited.")).toBeVisible();

  // 3. The client is notified, compares and shortlists.
  await client.goto("/dashboard/notifications");
  await expect(client.getByText(`New proposal for “${projectTitle}”`)).toBeVisible();
  await client.getByRole("button", { name: `Unread: New proposal for “${projectTitle}”` }).click();
  await expect(client).toHaveURL(/\/dashboard\/client\/projects\/[0-9a-f-]{36}$/);
  await client.getByRole("link", { name: "View proposal" }).click();
  await expect(client.getByRole("heading", { level: 1 })).toHaveText("Pat Voice Studio");
  // Next.js keeps the previous page hidden in the DOM, so text checks are scoped to a section.
  await expect(client.locator("#terms").getByText("$2,400.00")).toBeVisible();
  await client.getByRole("button", { name: "Shortlist" }).click();
  await expect(client.getByRole("button", { name: "Remove from shortlist" })).toBeVisible();

  // 4. The client messages the expert; the email address is hidden before any order.
  await client.getByRole("button", { name: "Message expert" }).click();
  await expect(client).toHaveURL(/\/dashboard\/messages\/[0-9a-f-]{36}$/);
  await client.locator("#message-body").fill("Hi Pat! Can we talk? My email is cora@example.com");
  await client.getByRole("button", { name: "Send", exact: true }).click();
  await expect(client.getByText("We hid the contact details", { exact: false })).toBeVisible();
  await expect(client.getByRole("region", { name: /Conversation with/ }).getByText("contact details hidden")).toBeVisible();
  await expect(client.getByText("cora@example.com")).toHaveCount(0);

  // 5. The expert reads it and replies; the reply reaches the client's open conversation.
  await expert.goto("/dashboard/messages");
  await expert.getByRole("link", { name: /Cora/ }).click();
  const thread = expert.getByRole("region", { name: /Conversation with Cora/ });
  await expect(thread.getByText("Hi Pat! Can we talk?", { exact: false })).toBeVisible();
  await expect(expert.getByText("cora@example.com")).toHaveCount(0);
  await expert.locator("#message-body").fill("Happy to. Let's keep it here on Greco.");
  await expert.getByRole("button", { name: "Send", exact: true }).click();
  await expect(expert.getByText("Sent.", { exact: true })).toBeVisible();

  await expectLiveText(client, "Happy to. Let's keep it here on Greco.");

  await Promise.all([clientContext.close(), expertContext.close()]);
});
