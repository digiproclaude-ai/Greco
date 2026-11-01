import { expect, test } from "@playwright/test";

// Public behaviour that needs no database: rendering, headers, redirects, validation.

test("homepage explains Greco and offers both paths", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find the right AI expert for your business problem.",
  );
  await expect(page.getByRole("link", { name: "Hire AI experts" })).toHaveAttribute("href", "/register?role=client");
  await expect(page.getByRole("link", { name: "Join as an expert" })).toHaveAttribute("href", "/register?role=expert");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("responses carry security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(headers["x-request-id"]).toBeTruthy();
});

test("legal pages are marked as drafts", async ({ page }) => {
  await page.goto("/legal/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of Service");
  await expect(page.getByText("Draft placeholder")).toBeVisible();
});

test("unknown pages return the localized 404", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

for (const path of ["/dashboard", "/dashboard/expert", "/admin", "/en/dashboard/client"]) {
  test(`signed-out visitors are sent to login from ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.getByRole("heading", { name: "Log in to Greco" })).toBeVisible();
  });
}

test("login shows translated validation errors from the server", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("This field is required.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
});

test("password reset asks for a valid email", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
});

test("the jobs endpoint rejects unauthenticated calls", async ({ request }) => {
  const response = await request.post("/api/jobs/process-outbox");
  expect([401, 503]).toContain(response.status());
});
