"use server";

import { getLocale } from "next-intl/server";
import { refresh } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { parseMoneyToMinor } from "@/lib/money";
import { log } from "@/server/log";
import { echo, failed, succeeded, type ActionState } from "@/server/modules/shared/action-state";
import { expertContext, type ExpertContext } from "@/server/modules/shared/context";
import { dbErrorKey } from "@/server/modules/shared/db-errors";
import { toFieldErrors } from "@/server/modules/shared/validation";
import { getMarketplaceSettings } from "@/server/modules/settings/service";

import {
  deliverableSchema,
  MAX_PROPOSAL_DELIVERABLES,
  MAX_PROPOSAL_MILESTONES,
  MILESTONE_FIELDS,
  milestoneSchema,
  PROPOSAL_FIELDS,
  proposalSchema,
} from "./schemas";

const UUID = /^[0-9a-f-]{36}$/i;

type OwnedProposal = { id: string; status: string; currency: string; project_id: string };

/** Relationship + state check: the proposal belongs to this expert's provider (and is a draft when asked). */
async function ownedProposal(proposalId: string, { draft = true } = {}) {
  const ctx = await expertContext();
  if (!ctx || !UUID.test(proposalId)) return null;
  const { data } = await ctx.supabase
    .from("proposals")
    .select("id, status, currency, project_id")
    .eq("id", proposalId)
    .eq("provider_id", ctx.providerId)
    .maybeSingle();
  if (!data) return null;
  if (draft && data.status !== "draft") return null;
  return { ctx, proposal: data as OwnedProposal };
}

/** Open the expert's live proposal for a project, creating a draft when there is none. */
export async function startProposalAction(projectId: string): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx || !UUID.test(projectId)) return failed("notAllowed");
  const locale = await getLocale();
  const existing = await liveProposal(ctx, projectId);
  if (existing) return redirect({ href: `/dashboard/expert/proposals/${existing}`, locale });

  const { data: project } = await ctx.supabase.from("projects").select("id, currency, status").eq("id", projectId).maybeSingle();
  if (!project) return failed("notFound");
  if (project.status !== "open") return failed("wrongState");

  const id = crypto.randomUUID();
  const { error } = await ctx.supabase.from("proposals").insert({
    id,
    project_id: projectId,
    provider_id: ctx.providerId,
    submitted_by_user_id: ctx.userId,
    currency: project.currency,
  });
  if (error) {
    // A parallel request may have created it first.
    const raced = error.code === "23505" ? await liveProposal(ctx, projectId) : null;
    if (raced) return redirect({ href: `/dashboard/expert/proposals/${raced}`, locale });
    log.warn("proposals.create_failed", { code: error.code });
    return failed(dbErrorKey(error));
  }
  return redirect({ href: `/dashboard/expert/proposals/${id}`, locale });
}

async function liveProposal(ctx: ExpertContext, projectId: string) {
  const { data } = await ctx.supabase
    .from("proposals")
    .select("id")
    .eq("project_id", projectId)
    .eq("provider_id", ctx.providerId)
    .not("status", "in", "(withdrawn,declined,expired)")
    .maybeSingle();
  return data?.id ?? null;
}

export async function saveProposalAction(proposalId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await ownedProposal(proposalId);
  if (!scope) return failed("notAllowed");
  const values = echo(formData, PROPOSAL_FIELDS);
  const parsed = proposalSchema.safeParse({ ...Object.fromEntries(formData), currency: scope.proposal.currency });
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  const input = parsed.data;
  const settings = await getMarketplaceSettings();
  const deposit = input.paymentModel === "deposit";
  if (deposit && !settings.depositAllowedBps.includes(input.depositBps ?? -1)) {
    return failed("invalid", { fieldErrors: { depositBps: { key: "choice" } }, values });
  }

  const { error } = await scope.ctx.supabase
    .from("proposals")
    .update({
      proposed_solution: input.proposedSolution,
      relevant_experience: input.relevantExperience,
      questions: input.questions,
      conditions: input.conditions,
      pricing_model: input.pricingModel,
      price_minor: input.priceMinor,
      hours: input.pricingModel === "hourly_block" ? input.hours : null,
      estimated_days: input.estimatedDays,
      revisions_included: input.revisionsIncluded,
      payment_model: input.paymentModel,
      deposit_bps: deposit ? input.depositBps : null,
      balance_trigger: deposit ? input.balanceTrigger : null,
    })
    .eq("id", proposalId)
    .select("id")
    .single();
  if (error) return failed(dbErrorKey(error), { values });
  refresh();
  return succeeded();
}

export async function addMilestoneAction(proposalId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await ownedProposal(proposalId);
  if (!scope) return failed("notAllowed");
  const values = echo(formData, MILESTONE_FIELDS);
  const parsed = milestoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  const amountMinor = parsed.data.amount ? parseMoneyToMinor(parsed.data.amount, scope.proposal.currency) : null;
  if (!amountMinor) {
    return failed("invalid", { fieldErrors: { amount: { key: parsed.data.amount ? "amount" : "required" } }, values });
  }
  const { data: rows } = await scope.ctx.supabase.from("proposal_milestones").select("seq").eq("proposal_id", proposalId);
  if ((rows?.length ?? 0) >= MAX_PROPOSAL_MILESTONES) return failed("limitReached");
  const seq = (rows ?? []).reduce((max, row) => Math.max(max, row.seq), 0) + 1;
  const { error } = await scope.ctx.supabase.from("proposal_milestones").insert({
    proposal_id: proposalId,
    seq,
    title: parsed.data.title,
    description: parsed.data.description,
    amount_minor: amountMinor,
    due_offset_days: parsed.data.dueOffsetDays,
  });
  if (error) return failed(dbErrorKey(error), { values });
  refresh();
  return succeeded("added");
}

/** Remove a milestone and renumber the rest so the sequence stays 1..n. */
export async function removeMilestoneAction(proposalId: string, formData: FormData): Promise<void> {
  const scope = await ownedProposal(proposalId);
  if (!scope) return;
  const id = String(formData.get("id") ?? "");
  const { supabase } = scope.ctx;
  const { error } = await supabase.from("proposal_milestones").delete().eq("proposal_id", proposalId).eq("id", id);
  if (error) {
    log.warn("proposals.milestone_remove_failed", { code: error.code });
    return;
  }
  const { data: rest } = await supabase.from("proposal_milestones").select("id, seq").eq("proposal_id", proposalId).order("seq");
  for (const [index, row] of (rest ?? []).entries()) {
    if (row.seq !== index + 1) await supabase.from("proposal_milestones").update({ seq: index + 1 }).eq("id", row.id);
  }
  refresh();
}

export async function addProposalDeliverableAction(proposalId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await ownedProposal(proposalId);
  if (!scope) return failed("notAllowed");
  const parsed = deliverableSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, ["title"]) });
  const { count } = await scope.ctx.supabase
    .from("proposal_deliverables")
    .select("id", { count: "exact", head: true })
    .eq("proposal_id", proposalId);
  if ((count ?? 0) >= MAX_PROPOSAL_DELIVERABLES) return failed("limitReached");
  const { error } = await scope.ctx.supabase
    .from("proposal_deliverables")
    .insert({ proposal_id: proposalId, title: parsed.data.title, sort_order: count ?? 0 });
  if (error) return failed(dbErrorKey(error), { values: echo(formData, ["title"]) });
  refresh();
  return succeeded("added");
}

export async function removeProposalDeliverableAction(proposalId: string, formData: FormData): Promise<void> {
  const scope = await ownedProposal(proposalId);
  if (!scope) return;
  const id = String(formData.get("id") ?? "");
  const { error } = await scope.ctx.supabase.from("proposal_deliverables").delete().eq("proposal_id", proposalId).eq("id", id);
  if (error) log.warn("proposals.deliverable_remove_failed", { code: error.code });
  refresh();
}

export async function submitProposalAction(proposalId: string): Promise<ActionState> {
  const scope = await ownedProposal(proposalId);
  if (!scope) return failed("notAllowed");
  const { data: missing, error } = await scope.ctx.supabase.rpc("proposals_submit", { p_proposal_id: proposalId });
  if (error) return failed(dbErrorKey(error));
  if (missing && missing.length > 0) return failed("checklist", { missing });
  refresh();
  return succeeded("proposalSent");
}

export async function withdrawProposalAction(proposalId: string): Promise<void> {
  const scope = await ownedProposal(proposalId, { draft: false });
  if (!scope) return;
  const { error } = await scope.ctx.supabase.rpc("proposals_withdraw", { p_proposal_id: proposalId });
  if (error) log.warn("proposals.withdraw_failed", { code: error.code });
  refresh();
}

export async function deleteProposalAction(proposalId: string): Promise<void> {
  const scope = await ownedProposal(proposalId);
  if (!scope) return;
  const { error } = await scope.ctx.supabase.from("proposals").delete().eq("id", proposalId);
  if (error) {
    log.warn("proposals.delete_failed", { code: error.code });
    return;
  }
  return redirect({ href: `/dashboard/expert/projects/${scope.proposal.project_id}`, locale: await getLocale() });
}

export async function declineInvitationAction(invitationId: string): Promise<void> {
  const ctx = await expertContext();
  if (!ctx || !UUID.test(invitationId)) return;
  const { error } = await ctx.supabase.rpc("invitations_decline", { p_invitation_id: invitationId });
  if (error) log.warn("projects.invitation_decline_failed", { code: error.code });
  refresh();
}
