import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Avatar } from "@/components/marketplace/avatar";
import { StatusBadge } from "@/components/projects/summary";
import { Link } from "@/i18n/navigation";
import { formatMoney, splitDeposit } from "@/lib/money";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { getClientProject } from "@/server/modules/projects/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects.proposal.compare");
  return { title: t("title") };
}

export default function ComparePage({ params }: PageProps<"/[locale]/dashboard/client/projects/[id]/compare">) {
  return (
    <Suspense>
      <Compare params={params} />
    </Suspense>
  );
}

async function Compare({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireRole("client", `/dashboard/client/projects/${id}/compare`);
  const session = await getSessionClaims();
  if (!session || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, locale] = await Promise.all([getTranslations("projects"), getLocale()]);
  const data = await getClientProject(session.supabase, account.userId, id);
  if (!data) notFound();
  const proposals = data.proposals.filter((p) => p.status === "submitted" || p.status === "shortlisted");
  // Shortlisted first, then by price.
  proposals.sort((a, b) => Number(b.status === "shortlisted") - Number(a.status === "shortlisted") || (a.price_minor ?? 0) - (b.price_minor ?? 0));

  const money = (minor: number | null, currency: string) => (minor ? formatMoney(minor, currency, locale) : "—");
  const rows: { label: string; value: (p: (typeof proposals)[number]) => React.ReactNode }[] = [
    { label: t("proposal.compare.status"), value: (p) => <StatusBadge status={p.status} label={t(`proposal.statuses.${p.status}`)} /> },
    {
      label: t("proposal.price"),
      value: (p) =>
        p.pricing_model === "hourly_block" && p.hours
          ? `${money(p.price_minor, p.currency)} · ${t("proposal.hourlyBlock", { hours: p.hours })}`
          : money(p.price_minor, p.currency),
    },
    {
      label: t("proposal.payment"),
      value: (p) => {
        if (p.payment_model !== "deposit" || !p.price_minor || !p.deposit_bps || !p.balance_trigger) return t("proposal.full");
        const split = splitDeposit(p.price_minor, p.deposit_bps);
        return t("proposal.deposit", {
          deposit: money(split.deposit, p.currency),
          balance: money(split.balance, p.currency),
          trigger: t(`proposal.depositTriggers.${p.balance_trigger as "before_final_delivery"}`),
        });
      },
    },
    { label: t("proposal.timeline"), value: (p) => (p.estimated_days ? t("proposal.days", { count: p.estimated_days }) : "—") },
    { label: t("proposal.revisions"), value: (p) => t("proposal.revisionsCount", { count: p.revisions_included ?? 0 }) },
    { label: t("proposal.milestones"), value: (p) => t("proposal.compare.milestonesCount", { count: p.proposal_milestones.length }) },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid max-w-3xl gap-2">
        <Link href={`/dashboard/client/projects/${id}`} className="text-sm text-accent hover:underline">
          {t("proposal.back")}
        </Link>
        <h1 className="font-display text-3xl font-semibold">{t("proposal.compare.title")}</h1>
        <p className="text-ink-muted">{data.project.title}</p>
        <p className="text-sm text-ink-muted">{t("proposal.compare.intro")}</p>
      </div>
      {proposals.length === 0 ? (
        <p className="max-w-3xl rounded-lg border border-dashed border-line bg-surface p-8 text-center text-ink-muted">
          {t("proposal.compare.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">{t("proposal.compare.title")}</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="w-40 p-4 text-start font-medium text-ink-muted">
                  {t("proposal.compare.expert")}
                </th>
                {proposals.map((p) => {
                  const name = p.providers?.display_name ?? "—";
                  return (
                    <th key={p.id} scope="col" className="p-4 text-start align-top">
                      <span className="flex items-center gap-2">
                        <Avatar path={p.providers?.avatar?.path ?? null} name={name} size={32} />
                        <Link href={`/dashboard/client/proposals/${p.id}`} className="font-semibold hover:text-accent">
                          {name}
                        </Link>
                      </span>
                      {p.providers?.headline ? <span className="mt-1 block font-normal text-ink-muted">{p.providers.headline}</span> : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-line last:border-b-0">
                  <th scope="row" className="p-4 text-start align-top font-medium text-ink-muted">
                    {row.label}
                  </th>
                  {proposals.map((p) => (
                    <td key={p.id} className="p-4 align-top">
                      {row.value(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
