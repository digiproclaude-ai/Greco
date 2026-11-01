import { getLocale, getTranslations } from "next-intl/server";

import { Alert } from "@/components/ui/alert";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/server/auth/guards";

/** Sends the user to the workspace of their active role. */
export default async function DashboardIndex({ searchParams }: PageProps<"/[locale]/dashboard">) {
  const [account, params] = await Promise.all([requireUser("/dashboard"), searchParams]);
  if (params.error === "workspace") {
    const t = await getTranslations("dashboard");
    return <Alert variant="danger">{t("workspaceError")}</Alert>;
  }
  redirect({ href: `/dashboard/${account.profile.active_role}`, locale: await getLocale() });
}
