import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automated WCAG 2.1 A/AA checks on public pages (docs/DESIGN_SYSTEM.md, accessibility).
// Automated checks catch only part of the problems; keyboard and screen-reader passes stay manual.
const PAGES = ["/", "/categories", "/search?q=chatbot", "/experts", "/how-it-works", "/become-an-expert", "/login", "/register"];

for (const path of PAGES) {
  test(`no automatically detectable accessibility violations on ${path}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(
      results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5) })),
    ).toEqual([]);
  });
}
