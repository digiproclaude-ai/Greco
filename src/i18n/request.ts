import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";

import { loadMessages } from "./messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // Prefer the [locale] root param: it is known at prerender time, so pages stay static.
  // Server Actions and Route Handlers have no root params, so fall back to the locale the
  // proxy resolved for this request.
  let requested: string | undefined;
  try {
    requested = await rootLocale();
  } catch {
    requested = await requestLocale;
  }
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
    // Dates are shown in the user's own time zone where it matters (profiles store it).
    timeZone: "UTC",
  };
});
