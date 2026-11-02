import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MfaSetup } from "@/components/dashboard/mfa-setup";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("security") };
}

export default async function SecuritySettingsPage({ searchParams }: PageProps<"/[locale]/dashboard/settings/security">) {
  const [account, params] = await Promise.all([requireUser("/dashboard/settings/security"), searchParams]);
  const session = await getSessionClaims();
  const { data: factors } = (await session?.supabase.auth.mfa.listFactors()) ?? { data: null };
  const mfaOn = (factors?.totp ?? []).some((factor) => factor.status === "verified");
  const t = await getTranslations("dashboard");

  return (
    <div className="grid max-w-2xl gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-semibold">{t("settings.securityTitle")}</h1>
        <p className="text-ink-muted">{t("settings.securityIntro")}</p>
      </div>
      {params.mfa === "required" && !mfaOn ? <Alert variant="warning">{t("mfaRequired")}</Alert> : null}
      <section aria-labelledby="mfa" className="grid gap-4 rounded-lg border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="mfa" className="text-lg font-semibold">
            {t("settings.mfa.title")}
          </h2>
          <Badge variant={mfaOn ? "success" : "neutral"}>
            {mfaOn ? t("settings.mfa.enabled") : t("settings.mfa.disabled")}
          </Badge>
        </div>
        <p className="text-[15px] text-ink-muted">{t("settings.mfa.description")}</p>
        {account.staffRoles.length > 0 ? <p className="text-sm font-medium">{t("settings.mfa.requiredForStaff")}</p> : null}
        {/* Turning MFA on refreshes the session cookies and this page, so the confirmation lives here. */}
        {mfaOn ? <Alert variant="success">{t("settings.mfa.done")}</Alert> : <MfaSetup />}
      </section>
    </div>
  );
}
