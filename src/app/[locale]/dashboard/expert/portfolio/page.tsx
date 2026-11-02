import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { listOwnPortfolio } from "@/server/modules/portfolio/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expert.portfolio");
  return { title: t("title") };
}

export default async function PortfolioPage() {
  const account = await requireRole("expert", "/dashboard/expert/portfolio");
  const session = await getSessionClaims();
  const t = await getTranslations("expert.portfolio");
  if (!session || !account.provider) return null;
  const items = await listOwnPortfolio(session.supabase, account.provider.id);

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
          <p className="text-ink-muted">{t("intro")}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/expert/portfolio/new">{t("new")}</Link>
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="grid min-w-0 gap-1">
                <p className="font-medium">{item.title}</p>
                {item.summary ? <p className="truncate text-sm text-ink-muted">{item.summary}</p> : null}
                <div className="flex gap-2">
                  <Badge variant={item.status === "published" ? "success" : "neutral"}>{t(`statuses.${item.status}`)}</Badge>
                  <Badge>{t(`provenance.${item.provenance}`)}</Badge>
                </div>
              </div>
              {item.provenance === "self_reported" ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/dashboard/expert/portfolio/${item.id}`}>{t("edit")}</Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
