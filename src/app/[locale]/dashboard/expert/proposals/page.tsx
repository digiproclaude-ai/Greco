import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { dateFormatter, StatusBadge } from "@/components/projects/summary";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { listMyProposals } from "@/server/modules/projects/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects.proposals");
  return { title: t("title") };
}

export default async function ExpertProposalsPage() {
  const account = await requireRole("expert", "/dashboard/expert/proposals");
  const session = await getSessionClaims();
  if (!session || !account.provider) return null;
  const [t, locale, date] = await Promise.all([getTranslations("projects"), getLocale(), dateFormatter()]);
  const proposals = await listMyProposals(session.supabase, account.provider.id);

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-display text-3xl font-semibold">{t("proposals.title")}</h1>
          <p className="text-ink-muted">{t("proposals.intro")}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard/expert/projects">{t("proposals.findProjects")}</Link>
        </Button>
      </div>
      {proposals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-ink-muted">{t("proposals.empty")}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="grid gap-1 px-5 py-4">
              <Link href={`/dashboard/expert/proposals/${proposal.id}`} className="font-medium hover:text-accent">
                {proposal.projects?.title ?? "—"}
              </Link>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                <StatusBadge status={proposal.status} label={t(`proposal.expertStatuses.${proposal.status}`)} />
                {proposal.price_minor ? <span>{formatMoney(proposal.price_minor, proposal.currency, locale)}</span> : null}
                <span>{t("proposals.updated", { date: date(proposal.updated_at) })}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
