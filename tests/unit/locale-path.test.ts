import { describe, expect, it } from "vitest";

import { splitLocale } from "@/lib/locale-path";

describe("splitLocale", () => {
  const locales = ["en", "de"] as const;

  it.each([
    ["/dashboard", { locale: null, path: "/dashboard" }],
    ["/de/dashboard", { locale: "de", path: "/dashboard" }],
    ["/en", { locale: "en", path: "/" }],
    ["/design", { locale: null, path: "/design" }],
  ])("splits %s", (input, expected) => {
    expect(splitLocale(input, locales)).toEqual(expected);
  });
});
