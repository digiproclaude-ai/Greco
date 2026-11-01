import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { MfaChallengeForm } from "@/components/auth/mfa-form";
import { redirect } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { getSessionClaims } from "@/server/auth/session";

import { AuthHeading } from "../auth-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("mfa") };
}

export default async function MfaPage({ searchParams }: PageProps<"/[locale]/mfa">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const session = await getSessionClaims();
  const locale = await getLocale();
  if (!session) redirect({ href: `/login?next=${encodeURIComponent(next)}`, locale });
  if (session?.aal === "aal2") redirect({ href: next, locale });

  const t = await getTranslations("auth.mfa");
  return (
    <>
      <AuthHeading title={t("title")} description={t("description")} />
      <MfaChallengeForm next={next} />
    </>
  );
}
