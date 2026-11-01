import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { requireStaff } from "@/server/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("admin") };
}

const SECTIONS = ["categories", "moderation", "users", "settings"] as const;

/** Admin home. Staff role + MFA (aal2) required; everything here is audited. */
export default async function AdminPage() {
  const account = await requireStaff();
  const [t, tCommon] = await Promise.all([getTranslations("admin"), getTranslations("common")]);
  return (
    <div className="grid max-w-3xl gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-ink-muted">{t("intro")}</p>
        <p className="text-sm">{t("rolesLabel", { roles: account.staffRoles.join(", ") })}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section} className="flex items-center justify-between rounded-lg border border-line bg-surface px-5 py-4">
            <span className="font-medium">{t(`sections.${section}`)}</span>
            <Badge>{tCommon("comingSoon")}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
