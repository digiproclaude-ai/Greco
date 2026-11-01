import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ResetPasswordForm } from "@/components/auth/password-forms";
import { redirect } from "@/i18n/navigation";
import { getSessionClaims } from "@/server/auth/session";

import { AuthHeading } from "../auth-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("resetPassword") };
}

/** Reached through the emailed reset link, which signs the user in for this purpose. */
export default async function ResetPasswordPage() {
  const session = await getSessionClaims();
  if (!session) redirect({ href: "/login?error=link", locale: await getLocale() });
  const t = await getTranslations("auth.reset");
  return (
    <>
      <AuthHeading title={t("title")} />
      <ResetPasswordForm />
    </>
  );
}
