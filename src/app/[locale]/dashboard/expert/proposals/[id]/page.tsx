import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ChecklistList } from "@/components/expert/status-panel";
import { EditorSection } from "@/components/forms/fields";
import { Prose } from "@/components/marketplace/prose";
import { ChecklistSubmitForm, ConfirmButton } from "@/components/projects/project-forms";
import { MilestonesEditor, ProposalDeliverablesEditor, ProposalForm } from "@/components/projects/proposal-forms";
import { dateFormatter, MilestoneList, ProposalTerms, StatusBadge } from "@/components/projects/summary";
import { Alert } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import {
  addMilestoneAction,
  addProposalDeliverableAction,
  deleteProposalAction,
  removeMilestoneAction,
  removeProposalDeliverableAction,
  saveProposalAction,
  submitProposalAction,
  withdrawProposalAction,
} from "@/server/modules/projects/proposal-actions";
import { MAX_PROPOSAL_MILESTONES } from "@/server/modules/projects/schemas";
import { getProposalEditor } from "@/server/modules/projects/service";
import { getMarketplaceSettings } from "@/server/modules/settings/service";

const CHECKLIST_KEYS = [
  "profile_approved",
  "project_open",
  "solution",
  "currency",
  "price",
  "min_order",
  "timeline",
  "deposit",
  "deposit_min_order",
  "milestones",
  "milestones_for_trigger",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects.proposalEditor");
  return { title: t("title") };
}

export default function ProposalEditorPage({ params }: PageProps<"/[locale]/dashboard/expert/proposals/[id]">) {
  return (
    <Suspense>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireRole("expert", `/dashboard/expert/proposals/${id}`);
  const session = await getSessionClaims();
  if (!session || !account.provider || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, locale, date, settings] = await Promise.all([
    getTranslations("projects"),
    getLocale(),
    dateFormatter(),
    getMarketplaceSettings(),
  ]);
  const data = await getProposalEditor(session.supabase, account.provider.id, id);
  if (!data) notFound();
  const { proposal, milestones, deliverables } = data;
  const status = proposal.status;
  const draft = status === "draft";
  const currency = proposal.currency;
  const bind = <A extends unknown[], R>(fn: (proposalId: string, ...rest: A) => R) => fn.bind(null, proposal.id) as (...rest: A) => R;
  const checklistLabels = Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, t(`proposalEditor.checklist.${key}`)]));
  const missing = data.missing.map((key) => checklistLabels[key] ?? key);
  const money = (minor: number | undefined) => (minor ? formatMoney(minor, currency, locale, { trimZeroFraction: true }) : "—");
  const rulesText = t("proposalEditor.rules", {
    minOrder: money(settings.minOrderMinor[currency]),
    depositMin: money(settings.depositMinOrderMinor[currency]),
  });
  const project = proposal.projects;

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        {project ? (
          <Link href={`/dashboard/expert/projects/${project.id}`} className="text-sm text-accent hover:underline">
            {t("proposalEditor.back")}
          </Link>
        ) : null}
        <p className="text-sm text-ink-muted">{t("proposalEditor.title")}</p>
        <h1 className="font-display text-3xl font-semibold">{project?.title ?? "—"}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
          <StatusBadge status={status} label={t(`proposal.expertStatuses.${status}`)} />
          {proposal.submitted_at ? <span>{t("proposal.submittedOn", { date: date(proposal.submitted_at) })}</span> : null}
        </div>
      </div>

      <EditorSection id="status" title={t("proposalEditor.sections.status")}>
        {draft ? (
          <>
            <ChecklistList title={t("proposalEditor.checklist.title")} doneLabel={t("proposalEditor.checklist.done")} items={missing} />
            <ChecklistSubmitForm
              action={bind(submitProposalAction)}
              label={t("proposalEditor.submit")}
              hint={t("proposalEditor.submitHint")}
              checklistLabels={checklistLabels}
              disabled={missing.length > 0}
            />
            <div>
              <ConfirmButton
                action={bind(deleteProposalAction)}
                label={t("proposalEditor.delete")}
                confirm={t("proposalEditor.deleteConfirm")}
                variant="ghost"
              />
            </div>
          </>
        ) : (
          <Alert>{t("proposalEditor.readOnly")}</Alert>
        )}
        {status === "declined" ? (
          <Alert variant="warning" title={t("proposalEditor.declined")}>
            {proposal.decline_reason ? <p>{t("proposalEditor.declinedReason", { reason: proposal.decline_reason })}</p> : null}
          </Alert>
        ) : null}
        {status === "submitted" || status === "shortlisted" ? (
          <div>
            <ConfirmButton
              action={bind(withdrawProposalAction)}
              label={t("proposalEditor.withdraw")}
              confirm={t("proposalEditor.withdrawConfirm")}
              variant="ghost"
            />
          </div>
        ) : null}
      </EditorSection>

      {draft ? (
        <>
          <EditorSection id="details" title={t("proposalEditor.sections.details")} description={t("proposalEditor.sections.detailsDescription")}>
            <ProposalForm
              action={bind(saveProposalAction)}
              currency={currency}
              depositOptions={settings.depositAllowedBps}
              commissionBps={settings.commissionBps}
              rulesText={rulesText}
              values={{
                proposedSolution: proposal.proposed_solution,
                relevantExperience: proposal.relevant_experience,
                questions: proposal.questions,
                conditions: proposal.conditions,
                pricingModel: proposal.pricing_model,
                priceMinor: proposal.price_minor,
                hours: proposal.hours,
                estimatedDays: proposal.estimated_days,
                revisionsIncluded: proposal.revisions_included,
                paymentModel: proposal.payment_model,
                depositBps: proposal.deposit_bps,
                balanceTrigger: proposal.balance_trigger,
              }}
            />
          </EditorSection>
          <EditorSection
            id="milestones"
            title={t("proposalEditor.sections.milestones")}
            description={t("proposalEditor.sections.milestonesDescription")}
          >
            <MilestonesEditor
              items={milestones.map((m) => ({
                id: m.id,
                seq: m.seq,
                title: m.title,
                description: m.description,
                amountMinor: m.amount_minor,
                dueOffsetDays: m.due_offset_days,
              }))}
              currency={currency}
              priceMinor={proposal.price_minor}
              addAction={bind(addMilestoneAction)}
              removeAction={bind(removeMilestoneAction)}
              max={MAX_PROPOSAL_MILESTONES}
            />
          </EditorSection>
          <EditorSection
            id="deliverables"
            title={t("proposalEditor.sections.deliverables")}
            description={t("proposalEditor.sections.deliverablesDescription")}
          >
            <ProposalDeliverablesEditor
              items={deliverables.map((d) => ({ id: d.id, title: d.title }))}
              addAction={bind(addProposalDeliverableAction)}
              removeAction={bind(removeProposalDeliverableAction)}
            />
          </EditorSection>
        </>
      ) : (
        <>
          <EditorSection id="terms" title={t("proposalEditor.sections.pricing")}>
            <ProposalTerms proposal={proposal} />
            {milestones.length > 0 ? <MilestoneList milestones={milestones} currency={currency} /> : null}
            {deliverables.length > 0 ? (
              <ul className="grid list-disc gap-1 ps-5">
                {deliverables.map((d) => (
                  <li key={d.id}>{d.title}</li>
                ))}
              </ul>
            ) : null}
          </EditorSection>
          {[
            [t("proposal.solution"), proposal.proposed_solution],
            [t("proposal.experience"), proposal.relevant_experience],
            [t("proposal.questions"), proposal.questions],
            [t("proposal.conditions"), proposal.conditions],
          ].map(([title, text]) =>
            text ? (
              <section key={title} className="grid gap-2">
                <h2 className="font-semibold">{title}</h2>
                <Prose text={text} />
              </section>
            ) : null,
          )}
        </>
      )}
    </div>
  );
}
