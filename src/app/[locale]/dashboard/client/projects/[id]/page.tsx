import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ChecklistList } from "@/components/expert/status-panel";
import { EditorSection } from "@/components/forms/fields";
import { Avatar } from "@/components/marketplace/avatar";
import {
  AttachmentUploadForm,
  ChecklistSubmitForm,
  ConfirmButton,
  InviteExpertForm,
  ProjectDetailsForm,
} from "@/components/projects/project-forms";
import { AttachmentList, dateFormatter, StatusBadge } from "@/components/projects/summary";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { MAX_ATTACHMENT_MB } from "@/server/modules/attachments/service";
import {
  changeProjectStatusAction,
  deleteProjectAction,
  inviteExpertAction,
  publishProjectAction,
  removeProjectAttachmentAction,
  saveProjectAction,
  uploadProjectAttachmentAction,
} from "@/server/modules/projects/actions";
import { MAX_PROJECT_ATTACHMENTS, MAX_PROJECT_TERMS, PROJECT_EDITABLE } from "@/server/modules/projects/schemas";
import { getClientProject } from "@/server/modules/projects/service";
import { getMarketplaceSettings } from "@/server/modules/settings/service";
import { termKindLabels, workTerms } from "@/server/modules/taxonomy/labels";
import { categoryOptions, getActiveTerms, getCategories } from "@/server/modules/taxonomy/service";

const CHECKLIST_KEYS = ["description", "category", "budget", "deadline"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects.editor");
  return { title: t("title") };
}

export default function ClientProjectPage({ params }: PageProps<"/[locale]/dashboard/client/projects/[id]">) {
  return (
    <Suspense>
      <ProjectWorkspace params={params} />
    </Suspense>
  );
}

async function ProjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireRole("client", `/dashboard/client/projects/${id}`);
  const session = await getSessionClaims();
  if (!session || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [t, locale, date] = await Promise.all([getTranslations("projects"), getLocale(), dateFormatter()]);
  const [data, categories, terms, kindLabels, settings] = await Promise.all([
    getClientProject(session.supabase, account.userId, id),
    getCategories(locale),
    getActiveTerms(locale),
    termKindLabels(),
    getMarketplaceSettings(),
  ]);
  if (!data) notFound();
  const { project } = data;
  const status = project.status;
  const editable = (PROJECT_EDITABLE as readonly string[]).includes(status);
  const bind = <A extends unknown[], R>(fn: (projectId: string, ...rest: A) => R) => fn.bind(null, project.id) as (...rest: A) => R;
  const checklistLabels = Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, t(`editor.checklist.${key}`)]));
  const missing = data.missing.map((key) => checklistLabels[key] ?? key);
  const options = categoryOptions(categories).map((option) => ({ value: option.id, label: option.label }));
  const liveProposals = data.proposals.filter((p) => p.status === "submitted" || p.status === "shortlisted");

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <Link href="/dashboard/client/projects" className="text-sm text-accent hover:underline">
          {t("client.back")}
        </Link>
        <h1 className="font-display text-3xl font-semibold">{project.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
          <StatusBadge status={status} label={t(`statuses.${status}`)} />
          <span>{t(`visibility.${project.visibility}.title`)}</span>
          {status === "open" && project.expires_at ? <span>{t("editor.expires", { date: date(project.expires_at) })}</span> : null}
        </div>
      </div>

      <EditorSection id="status" title={t("editor.sections.status")}>
        {status === "removed" ? <Alert variant="warning">{t("editor.removedNote")}</Alert> : null}
        {status === "draft" ? (
          <>
            <ChecklistList title={t("editor.checklist.title")} doneLabel={t("editor.checklist.done")} items={missing} />
            <ChecklistSubmitForm
              action={bind(publishProjectAction)}
              label={t("editor.publish")}
              hint={t("editor.publishHint")}
              checklistLabels={checklistLabels}
              disabled={missing.length > 0}
            />
          </>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {status === "open" ? (
            <ConfirmButton
              action={bind(changeProjectStatusAction)}
              name="action"
              value="close"
              label={t("editor.close")}
              confirm={t("editor.closeConfirm")}
            />
          ) : null}
          {status === "closed" || status === "expired" ? (
            <ConfirmButton action={bind(changeProjectStatusAction)} name="action" value="reopen" label={t("editor.reopen")} />
          ) : null}
          {status === "draft" ? (
            <ConfirmButton
              action={bind(deleteProjectAction)}
              label={t("editor.delete")}
              confirm={t("editor.deleteConfirm")}
              variant="danger"
            />
          ) : null}
        </div>
      </EditorSection>

      <EditorSection
        id="proposals"
        title={t("editor.sections.proposals")}
        aside={
          liveProposals.length >= 2 ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/dashboard/client/projects/${project.id}/compare`}>{t("editor.compare")}</Link>
            </Button>
          ) : null
        }
      >
        {status === "draft" ? (
          <p className="text-sm text-ink-muted">{t("editor.draftProposals")}</p>
        ) : data.proposals.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("editor.noProposals")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {data.proposals.map((proposal) => {
              const provider = proposal.providers;
              const name = provider?.display_name ?? "—";
              return (
                <li key={proposal.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar path={provider?.avatar?.path ?? null} name={name} size={40} />
                    <div className="grid min-w-0 gap-0.5">
                      <Link href={`/dashboard/client/proposals/${proposal.id}`} className="font-medium hover:text-accent">
                        {name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                        <StatusBadge status={proposal.status} label={t(`proposal.statuses.${proposal.status}`)} />
                        {proposal.price_minor ? <span>{formatMoney(proposal.price_minor, proposal.currency, locale)}</span> : null}
                        {proposal.estimated_days ? <span>{t("proposal.days", { count: proposal.estimated_days })}</span> : null}
                      </div>
                    </div>
                  </div>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/dashboard/client/proposals/${proposal.id}`}>{t("editor.viewProposal")}</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </EditorSection>

      <EditorSection id="invite" title={t("editor.sections.invite")}>
        {status === "open" ? (
          <InviteExpertForm action={bind(inviteExpertAction)} />
        ) : (
          <p className="text-sm text-ink-muted">{t("editor.invite.onlyOpen")}</p>
        )}
        {data.invitations.length > 0 ? (
          <ul className="divide-y divide-line rounded-md border border-line">
            {data.invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex items-center gap-3">
                  <Avatar path={invitation.providers?.avatar?.path ?? null} name={invitation.providers?.display_name ?? "—"} size={32} />
                  {invitation.providers?.handle ? (
                    <Link href={`/experts/${invitation.providers.handle}`} className="font-medium hover:text-accent">
                      {invitation.providers.display_name}
                    </Link>
                  ) : (
                    <span className="font-medium">{invitation.providers?.display_name ?? "—"}</span>
                  )}
                </span>
                <Badge variant={invitation.status === "declined" ? "warning" : invitation.status === "sent" ? "neutral" : "success"}>
                  {t(`editor.invite.statuses.${invitation.status}`)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : status === "open" ? (
          <p className="text-sm text-ink-muted">{t("editor.invite.empty")}</p>
        ) : null}
      </EditorSection>

      {!editable ? <Alert>{t("editor.readOnly", { status: t(`statuses.${status}`).toLowerCase() })}</Alert> : null}

      <fieldset disabled={!editable} className="grid min-w-0 gap-6 disabled:opacity-70">
        <EditorSection id="details" title={t("editor.sections.details")} description={t("editor.sections.detailsDescription")}>
          <ProjectDetailsForm
            action={bind(saveProjectAction)}
            values={{
              title: project.title,
              description: project.description,
              businessProblem: project.business_problem,
              desiredOutcome: project.desired_outcome,
              category: project.category_id,
              termIds: data.termIds,
              budgetKind: project.budget_kind,
              currency: project.currency,
              budgetMinMinor: project.budget_min_minor,
              budgetMaxMinor: project.budget_max_minor,
              timelineKind: project.timeline_kind,
              deadline: project.deadline,
              visibility: project.visibility,
            }}
            categories={options}
            terms={workTerms(terms, data.termIds)}
            kindLabels={kindLabels}
            currencies={settings.currencies}
            currencyLocked={status !== "draft"}
            maxTerms={MAX_PROJECT_TERMS}
          />
        </EditorSection>

        <EditorSection id="attachments" title={t("editor.sections.attachments")} description={t("editor.sections.attachmentsDescription")}>
          <AttachmentList files={data.attachments} removeAction={editable ? bind(removeProjectAttachmentAction) : undefined} />
          {editable && data.attachments.length < MAX_PROJECT_ATTACHMENTS ? (
            <AttachmentUploadForm action={bind(uploadProjectAttachmentAction)} maxMb={MAX_ATTACHMENT_MB} />
          ) : null}
        </EditorSection>
      </fieldset>
    </div>
  );
}
