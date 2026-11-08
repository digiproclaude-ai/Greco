import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EditorSection } from "@/components/forms/fields";
import { Prose } from "@/components/marketplace/prose";
import { ContactButton } from "@/components/messages/contact-button";
import { ConfirmButton } from "@/components/projects/project-forms";
import { StartProposalForm } from "@/components/projects/proposal-forms";
import { AttachmentList, budgetText, dateFormatter, StatusBadge } from "@/components/projects/summary";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { contactClientAction } from "@/server/modules/messaging/actions";
import { declineInvitationAction, startProposalAction } from "@/server/modules/projects/proposal-actions";
import { getProjectForExpert } from "@/server/modules/projects/service";
import { getActiveTerms, getCategories } from "@/server/modules/taxonomy/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects.board");
  return { title: t("title") };
}

export default function ExpertProjectPage({ params }: PageProps<"/[locale]/dashboard/expert/projects/[id]">) {
  return (
    <Suspense>
      <ProjectView params={params} />
    </Suspense>
  );
}

async function ProjectView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireRole("expert", `/dashboard/expert/projects/${id}`);
  const session = await getSessionClaims();
  if (!session || !account.provider || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, locale, date] = await Promise.all([getTranslations("projects"), getLocale(), dateFormatter()]);
  const [data, categories, terms] = await Promise.all([
    getProjectForExpert(session.supabase, account.userId, account.provider.id, id),
    getCategories(locale),
    getActiveTerms(locale),
  ]);
  if (!data) notFound();
  const { project, invitation } = data;
  const live = data.proposals.find((p) => !["withdrawn", "declined", "expired"].includes(p.status));
  const past = data.proposals.filter((p) => p !== live);
  const accepting = project.status === "open" && (!project.expires_at || new Date(project.expires_at) > new Date());
  const category = categories.find((c) => c.id === project.category_id);
  const termNames = terms.filter((term) => data.termIds.includes(term.id)).map((term) => term.name);
  const canContact = Boolean(invitation) || data.proposals.some((p) => p.status !== "draft");
  const ownProject = project.client_user_id === account.userId;

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <Link href="/dashboard/expert/projects" className="text-sm text-accent hover:underline">
          {t("expertProject.back")}
        </Link>
        <h1 className="font-display text-3xl font-semibold">{project.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          <StatusBadge status={project.status} label={t(`statuses.${project.status}`)} />
          <span>{budgetText(t, project, locale)}</span>
          <span>{t(`timelineKinds.${project.timeline_kind}`)}</span>
          {project.deadline ? <span>{t("expertProject.deadline", { date: date(project.deadline) })}</span> : null}
          {category ? <span>{category.name}</span> : null}
          <span>{t("board.proposals", { count: project.proposals_count })}</span>
        </div>
      </div>

      {invitation ? (
        <Alert title={t("expertProject.invitation")}>
          {invitation.message ? (
            <div className="mt-1 grid gap-1">
              <p className="text-sm font-medium">{t("expertProject.invitationMessage")}</p>
              <Prose text={invitation.message} />
            </div>
          ) : null}
          {invitation.status === "declined" ? <p className="mt-2 text-sm">{t("board.declined")}</p> : null}
          {invitation.status === "sent" && accepting ? (
            <div className="mt-3">
              <ConfirmButton action={declineInvitationAction.bind(null, invitation.id)} label={t("board.decline")} variant="ghost" />
            </div>
          ) : null}
        </Alert>
      ) : null}

      <EditorSection id="your-proposal" title={t("expertProject.yourProposal")}>
        {live ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge status={live.status} label={t(`proposal.expertStatuses.${live.status}`)} />
            <Button asChild variant={live.status === "draft" ? "primary" : "secondary"}>
              <Link href={`/dashboard/expert/proposals/${live.id}`}>
                {live.status === "draft" ? t("expertProject.continueProposal") : t("expertProject.viewProposal")}
              </Link>
            </Button>
          </div>
        ) : accepting && !ownProject ? (
          <StartProposalForm action={startProposalAction.bind(null, project.id)} label={t("expertProject.writeProposal")} />
        ) : (
          <p className="text-sm text-ink-muted">{t("expertProject.closed")}</p>
        )}
        {past.length > 0 ? (
          <ul className="grid gap-1 text-sm text-ink-muted">
            {past.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/expert/proposals/${p.id}`} className="hover:text-accent">
                  {t(`proposal.expertStatuses.${p.status}`)}
                </Link>
                {p.submitted_at ? ` · ${date(p.submitted_at)}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
        {canContact && !ownProject ? (
          <div>
            <ContactButton action={contactClientAction.bind(null, project.client_user_id, project.id)} label={t("expertProject.messageClient")} />
          </div>
        ) : null}
      </EditorSection>

      <section className="grid gap-4 rounded-lg border border-line bg-surface p-5">
        <Prose text={project.description} />
        {project.business_problem ? (
          <div className="grid gap-1">
            <h2 className="font-semibold">{t("editor.fields.businessProblem")}</h2>
            <Prose text={project.business_problem} />
          </div>
        ) : null}
        {project.desired_outcome ? (
          <div className="grid gap-1">
            <h2 className="font-semibold">{t("editor.fields.desiredOutcome")}</h2>
            <Prose text={project.desired_outcome} />
          </div>
        ) : null}
        {termNames.length > 0 ? (
          <div className="grid gap-2">
            <h2 className="font-semibold">{t("editor.fields.terms")}</h2>
            <ul className="flex flex-wrap gap-1.5">
              {termNames.map((name) => (
                <li key={name}>
                  <Badge>{name}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {data.attachments.length > 0 ? (
        <EditorSection id="files" title={t("editor.sections.attachments")}>
          <AttachmentList files={data.attachments} />
        </EditorSection>
      ) : null}
    </div>
  );
}
