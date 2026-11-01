import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { AuthHeading } from "../auth-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("checkEmail") };
}

export default async function CheckEmailPage() {
  const t = await getTranslations("auth.checkEmail");
  return (
    <>
      <AuthHeading title={t("title")} description={t("body")} />
      <p className="mb-6 text-sm text-ink-muted">{t("spam")}</p>
      <Link href="/login" className="text-sm font-medium text-accent hover:underline">
        {t("back")}
      </Link>
    </>
  );
}
