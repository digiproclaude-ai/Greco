import { expect, test } from "@playwright/test";

// Public behaviour that needs no database: rendering, headers, redirects, validation.
// In this job the database is unreachable, so marketplace pages wait for the Supabase client's
// retries (about 7 s) before showing their empty states; those tests allow for that.
const SLOW = { timeout: 30_000 };

test("homepage explains Greco and offers both paths", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find the right AI expert for your business problem.",
  );
  await expect(page.getByRole("link", { name: "Hire AI experts" })).toHaveAttribute("href", "/categories");
  await expect(page.getByRole("link", { name: "Join as an expert" })).toHaveAttribute("href", "/become-an-expert");
  await expect(page.getByRole("search")).toBeVisible();
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

test("marketplace pages render without an account", async ({ page }) => {
  test.setTimeout(180_000);
  for (const [path, heading] of [
    ["/categories", "Browse categories"],
    ["/search", "Search services"],
    ["/experts", "Find AI experts"],
    ["/how-it-works", "How Greco works"],
    ["/become-an-expert", "Offer your AI services on Greco"],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading, SLOW);
  }
});

test("search keeps the query and shows a results count", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByRole("search").getByRole("searchbox").fill("voice agent");
  await page.getByRole("search").getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search\?q=voice\+agent/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText('Services for "voice agent"', SLOW);
  // The count depends on what other flows have published, so only its format is checked.
  await expect(page.getByRole("heading", { level: 2, name: /^(No services found|\d+ services?)$/ })).toBeVisible(SLOW);
});

test("unknown experts and services return the 404 page", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/experts/nobody-here-123");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible(SLOW);
  await page.goto("/experts/nobody-here-123/no-such-service");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible(SLOW);
});

test("robots.txt keeps private areas out of search engines", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toContain("Disallow: /dashboard");
  expect(body).toContain("Disallow: /admin");
  expect(body).toContain("Sitemap:");
});

for (const path of [
  "/dashboard/expert/profile",
  "/dashboard/expert/services/new",
  "/admin/moderation",
  "/dashboard/client/projects/new",
  "/dashboard/expert/projects",
  "/dashboard/messages",
  "/dashboard/notifications",
  "/admin/reports",
]) {
  test(`editors and admin pages need an account: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
  });
}

test("private files need an account", async ({ request }) => {
  const response = await request.get("/api/files/00000000-0000-4000-8000-000000000001", { maxRedirects: 0 });
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
});
