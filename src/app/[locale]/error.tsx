"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return (
    <main id="main" className="mx-auto grid max-w-xl flex-1 content-center gap-4 px-4 py-20">
      <h1 className="font-display text-4xl font-semibold">{t("errors.generic.title")}</h1>
      <p className="text-lg text-ink-muted">{t("errors.generic.body")}</p>
      <div>
        <Button onClick={reset}>{t("common.actions.retry")}</Button>
      </div>
    </main>
  );
}
