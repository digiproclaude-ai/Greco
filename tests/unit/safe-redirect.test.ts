import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it.each([
    ["/dashboard/expert", "/dashboard/expert"],
    ["/admin?tab=users#top", "/admin?tab=users#top"],
    ["/a/../dashboard", "/dashboard"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "dashboard",
    "",
    "/\u0000x",
    `/${"a".repeat(600)}`,
    undefined,
    42,
  ])("falls back for unsafe value %s", (input) => {
    expect(safeNextPath(input)).toBe("/dashboard");
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("//x", "/login")).toBe("/login");
  });
});
