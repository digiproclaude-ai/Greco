import { Search } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPathname } from "@/i18n/navigation";

/** Plain GET form to the search page; works without JavaScript. */
export async function SearchBox({
  action = "/search",
  defaultValue,
  placeholder,
  size = "md",
}: {
  action?: "/search" | "/experts";
  defaultValue?: string | null;
  placeholder?: string;
  size?: "md" | "lg";
}) {
  const [t, locale] = await Promise.all([getTranslations("marketplace.search"), getLocale()]);
  return (
    <form role="search" action={getPathname({ href: action, locale })} method="get" className="flex w-full gap-2">
      <label htmlFor={`q-${action}`} className="sr-only">
        {t("label")}
      </label>
      <div className="relative flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
        <Input
          id={`q-${action}`}
          name="q"
          type="search"
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder ?? t("placeholder")}
          maxLength={120}
          className={size === "lg" ? "h-12 ps-9 text-base" : "ps-9"}
        />
      </div>
      <Button type="submit" size={size === "lg" ? "lg" : "md"}>
        {t("submit")}
      </Button>
    </form>
  );
}
