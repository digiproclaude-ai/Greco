import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { listOwnListings } from "@/server/modules/catalog/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expert.services");
  return { title: t("title") };
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "neutral" | "accent"> = {
  published: "success",
  pending_review: "accent",
  rejected: "warning",
  suspended: "warning",
};

export default async function ServicesPage() {
  const account = await requireRole("expert", "/dashboard/expert/services");
  const session = await getSessionClaims();
  const [t, format] = await Promise.all([getTranslations("expert.services"), getFormatter()]);
  if (!session || !account.provider) return null;
  const listings = await listOwnListings(session.supabase, account.provider.id);

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
          <p className="text-ink-muted">{t("intro")}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/expert/services/new">{t("new")}</Link>
        </Button>
      </div>
      {listings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {listings.map((listing) => (
            <li key={listing.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="grid min-w-0 gap-1">
                <Link href={`/dashboard/expert/services/${listing.id}`} className="font-medium hover:text-accent">
                  {listing.title}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  <Badge variant={STATUS_VARIANT[listing.status] ?? "neutral"}>{t(`statuses.${listing.status}`)}</Badge>
                  <span>{t("updated", { date: format.dateTime(new Date(listing.updated_at), { dateStyle: "medium" }) })}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {listing.status === "published" && account.provider?.status === "active" ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/experts/${account.provider.handle}/${listing.slug}`}>{t("view")}</Link>
                  </Button>
                ) : null}
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/dashboard/expert/services/${listing.id}`}>{t("edit")}</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
