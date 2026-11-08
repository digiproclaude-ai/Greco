import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { getAdminCounts } from "@/server/modules/admin/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("admin") };
}

/** Admin home. Staff role + MFA (aal2) required; everything here is audited. */
export default async function AdminPage() {
  const account = await requireStaff();
  const session = await getSessionClaims();
  const t = await getTranslations("admin");
  if (!session) return null;
  const counts = await getAdminCounts(session.supabase);
  const cards = [
    { text: t("overview.pendingProfiles", { count: counts.profiles }), href: "/admin/moderation", cta: t("overview.openQueue") },
    { text: t("overview.pendingListings", { count: counts.listings }), href: "/admin/moderation", cta: t("overview.openQueue") },
    { text: t("overview.pendingEdits", { count: counts.edits }), href: "/admin/moderation", cta: t("overview.openQueue") },
    { text: t("overview.pendingTerms", { count: counts.terms }), href: "/admin/taxonomy?status=pending", cta: t("overview.openTaxonomy") },
    { text: t("overview.openReports", { count: counts.reports }), href: "/admin/reports", cta: t("overview.openReportsCta") },
  ];
  return (
    <div className="grid max-w-4xl gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-ink-muted">{t("intro")}</p>
        <p className="text-sm">{t("rolesLabel", { roles: account.staffRoles.join(", ") })}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.text} className="flex flex-col justify-between gap-3 rounded-lg border border-line bg-surface px-5 py-4">
            <span className="font-medium">{card.text}</span>
            <div>
              <Button asChild size="sm" variant="secondary">
                <Link href={card.href}>{card.cta}</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
