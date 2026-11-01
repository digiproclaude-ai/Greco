import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import { getPublicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";

import { AuthHeading } from "../auth-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("login") };
}

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const params = await searchParams;
  const t = await getTranslations("auth");
  const next = safeNextPath(params.next);

  return (
    <>
      <AuthHeading title={t("login.title")} description={t("login.description")} />
      <div className="grid gap-4">
        {params.signedOut ? <Alert variant="success">{t("login.signedOut")}</Alert> : null}
        {params.passwordUpdated ? <Alert variant="success">{t("login.passwordUpdated")}</Alert> : null}
        {params.error === "link" ? <Alert variant="warning">{t("login.linkError")}</Alert> : null}
        {params.error === "generic" ? <Alert variant="danger">{t("errors.generic")}</Alert> : null}
        <LoginForm next={next} googleEnabled={getPublicEnv().NEXT_PUBLIC_AUTH_GOOGLE_ENABLED} />
      </div>
    </>
  );
}
