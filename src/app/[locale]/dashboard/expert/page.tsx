import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ProviderStatusPanel } from "@/components/expert/status-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth/guards";
import { displayNameOf, getSessionClaims } from "@/server/auth/session";
import { getExpertOverview } from "@/server/modules/providers/service";
import { formatBps, getMarketplaceSettings } from "@/server/modules/settings/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.expert");
  return { title: t("title") };
}

export default async function ExpertWorkspacePage() {
  const account = await requireRole("expert", "/dashboard/expert");
  const session = await getSessionClaims();
  const [t, tExpert, locale, settings] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("expert"),
    getLocale(),
    getMarketplaceSettings(),
  ]);
  if (!session || !account.provider) return null;

  const overview = await getExpertOverview(session.supabase, account.provider.id);
  const { data: lastDecision } = await session.supabase
    .from("moderation_actions")
    .select("action, reason")
    .eq("target_type", "provider")
    .eq("target_id", account.provider.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const counts = overview.listingsByStatus;

  return (
    <div className="grid max-w-4xl gap-8">
      <div className="grid gap-2">
        <p className="text-sm font-medium text-ink-muted">{t("expert.title")}</p>
        <h1 className="font-display text-3xl font-semibold">{t("greeting", { name: displayNameOf(account) })}</h1>
        <p className="text-ink-muted">{t("expert.intro")}</p>
      </div>
      <ProviderStatusPanel status={account.provider.status} lastDecision={lastDecision ?? null} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col">
          <CardContent className="grid flex-1 gap-1">
            <h2 className="font-semibold">{tExpert("overview.profileCard")}</h2>
            <p className="text-sm text-ink-muted">{tExpert("overview.missingItems", { count: overview.missing.length })}</p>
          </CardContent>
          <CardFooter>
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard/expert/profile">{tExpert("overview.editProfile")}</Link>
            </Button>
          </CardFooter>
        </Card>
        <Card className="flex flex-col">
          <CardContent className="grid flex-1 gap-1">
            <h2 className="font-semibold">{tExpert("overview.servicesCard")}</h2>
            <p className="text-sm text-ink-muted">
              {tExpert("overview.serviceCounts", {
                published: counts.published ?? 0,
                drafts: (counts.draft ?? 0) + (counts.rejected ?? 0),
                review: counts.pending_review ?? 0,
              })}
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard/expert/services">{tExpert("overview.manageServices")}</Link>
            </Button>
          </CardFooter>
        </Card>
        <Card className="flex flex-col">
          <CardContent className="grid flex-1 gap-1">
            <h2 className="font-semibold">{tExpert("overview.portfolioCard")}</h2>
            <p className="text-sm text-ink-muted">{tExpert("overview.portfolioCount", { count: overview.portfolioCount })}</p>
          </CardContent>
          <CardFooter>
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard/expert/portfolio">{tExpert("overview.managePortfolio")}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
      <section aria-labelledby="payouts" className="rounded-lg border border-line bg-surface p-5">
        <h2 id="payouts" className="font-semibold">
          {tExpert("overview.payoutsTitle")}
        </h2>
        <p className="mt-1 text-[15px] text-ink-muted">{tExpert("overview.payoutsBody", { commission: formatBps(settings.commissionBps, locale) })}</p>
      </section>
    </div>
  );
}
