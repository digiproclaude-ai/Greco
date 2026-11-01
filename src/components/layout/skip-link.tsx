import { useTranslations } from "next-intl";

export function SkipLink() {
  const t = useTranslations("nav");
  return (
    <a
      href="#main"
      className="sr-only rounded-md bg-accent px-3 py-2 text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
    >
      {t("skipToContent")}
    </a>
  );
}
