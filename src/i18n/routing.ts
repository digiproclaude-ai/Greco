import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
  // English URLs stay prefix-free; future languages get /de/..., /fr/... (ARCHITECTURE.md §14).
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
