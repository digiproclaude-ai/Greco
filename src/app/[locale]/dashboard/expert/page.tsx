import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { NextSteps } from "@/components/dashboard/next-steps";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/server/auth/guards";
import { displayNameOf } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.expert");
  return { title: t("title") };
}

export default async function ExpertWorkspacePage() {
  const account = await requireRole("expert", "/dashboard/expert");
  const [t, tCommon] = await Promise.all([getTranslations("dashboard"), getTranslations("common")]);
  const status = account.provider?.status ?? "draft";
  return (
    <div className="grid max-w-3xl gap-8">
      <div className="grid gap-2">
        <p className="text-sm font-medium text-ink-muted">{t("expert.title")}</p>
        <h1 className="font-display text-3xl font-semibold">{t("greeting", { name: displayNameOf(account) })}</h1>
        <p className="text-ink-muted">{t("expert.intro")}</p>
        <div>
          <Badge variant={status === "active" ? "success" : "neutral"}>
            {t("expert.status", { status: t(`expert.statuses.${status}`) })}
          </Badge>
        </div>
      </div>
      <NextSteps
        title={t("expert.nextStepsTitle")}
        comingSoon={tCommon("comingSoon")}
        steps={[t("expert.steps.profile"), t("expert.steps.service"), t("expert.steps.payouts")]}
      />
    </div>
  );
}
