import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { NextSteps } from "@/components/dashboard/next-steps";
import { requireRole } from "@/server/auth/guards";
import { displayNameOf } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.client");
  return { title: t("title") };
}

export default async function ClientWorkspacePage() {
  const account = await requireRole("client", "/dashboard/client");
  const [t, tCommon] = await Promise.all([getTranslations("dashboard"), getTranslations("common")]);
  return (
    <div className="grid max-w-3xl gap-8">
      <div className="grid gap-2">
        <p className="text-sm font-medium text-ink-muted">{t("client.title")}</p>
        <h1 className="font-display text-3xl font-semibold">{t("greeting", { name: displayNameOf(account) })}</h1>
        <p className="text-ink-muted">{t("client.intro")}</p>
      </div>
      <NextSteps
        title={t("client.nextStepsTitle")}
        comingSoon={tCommon("comingSoon")}
        steps={[t("client.steps.profile"), t("client.steps.discover"), t("client.steps.browse")]}
      />
    </div>
  );
}
