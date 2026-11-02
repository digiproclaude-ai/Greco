import { expect, test, type Page } from "@playwright/test";

/*
 * Full account lifecycle against a local Supabase stack (CI: `supabase start`).
 * Skipped unless E2E_SUPABASE=1, because it creates real accounts and reads the local mail
 * catcher (Mailpit).
 */
test.skip(process.env.E2E_SUPABASE !== "1", "needs a local Supabase stack (E2E_SUPABASE=1)");

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

async function confirmationLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const list = (await (await fetch(`${MAILPIT_URL}/api/v1/messages?limit=50`)).json()) as {
      messages?: { ID: string; To?: { Address: string }[] }[];
    };
    const message = list.messages?.find((item) => item.To?.some((to) => to.Address.toLowerCase() === email));
    if (message) {
      const detail = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`)).json()) as {
        Text?: string;
        HTML?: string;
      };
      const body = `${detail.Text ?? ""} ${detail.HTML ?? ""}`;
      const link = body.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]*/)?.[0];
      if (link) return link.replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`No confirmation email for ${email}`);
}

async function register(page: Page, email: string, password: string) {
  await page.goto("/register?role=client");
  await page.getByLabel("Full name").fill("Elena Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Country").selectOption("RO");
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
}

test("register, confirm, switch workspace, log out and back in", async ({ page }) => {
  const email = `e2e-${Date.now()}@greco.test`;
  const password = "a long test password";

  await register(page, email, password);

  await page.goto(await confirmationLink(email));
  await expect(page).toHaveURL(/\/dashboard\/client$/);
  await expect(page.getByRole("heading", { name: "Welcome, Elena Test" })).toBeVisible();

  // Add the expert role from the workspace switcher (D-05).
  await page.getByRole("button", { name: "Offer services" }).click();
  await expect(page).toHaveURL(/\/dashboard\/expert$/);
  await expect(page.getByText("Not public yet. Complete the checklist and submit your profile for review.")).toBeVisible();

  // Non-staff get the not-found page and no admin content. (The status can still be 200:
  // the page streams, so the response starts before the staff check runs.)
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toHaveCount(0);

  await page.goto("/dashboard/expert");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page.getByText("You have been logged out.")).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  // The expert workspace was the last one used.
  await expect(page).toHaveURL(/\/dashboard\/expert$/);
});

test("wrong passwords get a clear, non-revealing error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@greco.test");
  await page.getByLabel("Password").fill("definitely wrong");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("That email and password don't match.")).toBeVisible();
});
