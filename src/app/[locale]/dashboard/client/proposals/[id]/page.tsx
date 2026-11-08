import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EditorSection } from "@/components/forms/fields";
import { Avatar } from "@/components/marketplace/avatar";
import { Prose } from "@/components/marketplace/prose";
import { ContactButton } from "@/components/messages/contact-button";
import { ProposalDecisionForm } from "@/components/projects/project-forms";
import { dateFormatter, MilestoneList, ProposalTerms, StatusBadge } from "@/components/projects/summary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { contactExpertAction } from "@/server/modules/messaging/actions";
import { decideProposalAction } from "@/server/modules/projects/actions";
import { getProposalForClient } from "@/server/modules/projects/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects.proposalEditor");
  return { title: t("title") };
}

export default function ClientProposalPage({ params }: PageProps<"/[locale]/dashboard/client/proposals/[id]">) {
  return (
    <Suspense>
      <ProposalView params={params} />
    </Suspense>
  );
}

async function ProposalView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireRole("client", `/dashboard/client/proposals/${id}`);
  const session = await getSessionClaims();
  if (!session || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, date] = await Promise.all([getTranslations("projects"), dateFormatter()]);
  const proposal = await getProposalForClient(session.supabase, account.userId, id);
  if (!proposal) notFound();
  const provider = proposal.providers;
  const name = provider?.display_name ?? "—";
  const sections: [string, string | null][] = [
    [t("proposal.solution"), proposal.proposed_solution],
    [t("proposal.experience"), proposal.relevant_experience],
    [t("proposal.questions"), proposal.questions],
    [t("proposal.conditions"), proposal.conditions],
  ];

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-3">
        <Link href={`/dashboard/client/projects/${proposal.projects.id}`} className="text-sm text-accent hover:underline">
          {t("proposal.back")}
        </Link>
        <p className="text-sm text-ink-muted">{proposal.projects.title}</p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar path={provider?.avatar?.path ?? null} name={name} size={56} />
            <div className="grid gap-1">
              <h1 className="font-display text-2xl font-semibold">{name}</h1>
              {provider?.headline ? <p className="text-ink-muted">{provider.headline}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {provider?.handle ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/experts/${provider.handle}`}>{t("proposal.expertProfile")}</Link>
              </Button>
            ) : null}
            {provider ? (
              <ContactButton
                action={contactExpertAction.bind(null, { providerId: provider.id, projectId: proposal.projects.id })}
                label={t("proposal.message")}
              />
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
          <StatusBadge status={proposal.status} label={t(`proposal.statuses.${proposal.status}`)} />
          {proposal.submitted_at ? <span>{t("proposal.submittedOn", { date: date(proposal.submitted_at) })}</span> : null}
          {proposal.valid_until && (proposal.status === "submitted" || proposal.status === "shortlisted") ? (
            <span>{t("proposal.validUntil", { date: date(proposal.valid_until) })}</span>
          ) : null}
        </div>
      </div>

      <Alert>{t("proposal.hiringSoon")}</Alert>

      {proposal.status === "submitted" || proposal.status === "shortlisted" ? (
        <ProposalDecisionForm action={decideProposalAction.bind(null, proposal.id)} status={proposal.status} />
      ) : null}
      {proposal.status === "declined" && proposal.decline_reason ? (
        <p className="text-sm text-ink-muted">{t("proposal.decide.declinedReason", { reason: proposal.decline_reason })}</p>
      ) : null}

      <EditorSection id="terms" title={t("proposalEditor.sections.pricing")}>
        <ProposalTerms proposal={proposal} />
        {proposal.proposal_milestones.length > 0 ? (
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">{t("proposal.milestones")}</h3>
            <MilestoneList milestones={proposal.proposal_milestones} currency={proposal.currency} />
          </div>
        ) : null}
        {proposal.proposal_deliverables.length > 0 ? (
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">{t("proposal.deliverables")}</h3>
            <ul className="grid list-disc gap-1 ps-5">
              {proposal.proposal_deliverables.map((d) => (
                <li key={d.id}>{d.title}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </EditorSection>

      {sections.map(([title, text]) =>
        text ? (
          <section key={title} className="grid gap-2">
            <h2 className="font-semibold">{title}</h2>
            <Prose text={text} />
          </section>
        ) : null,
      )}
    </div>
  );
}
