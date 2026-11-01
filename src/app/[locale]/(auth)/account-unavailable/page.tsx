import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SubmitButton } from "@/components/auth/form-parts";
import { signOutAction } from "@/server/modules/identity/actions";

import { AuthHeading } from "../auth-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("unavailable") };
}

export default async function AccountUnavailablePage() {
  const t = await getTranslations("auth.unavailable");
  return (
    <>
      <AuthHeading title={t("title")} description={t("body")} />
      <form action={signOutAction}>
        <SubmitButton variant="secondary">{t("signOut")}</SubmitButton>
      </form>
    </>
  );
}
