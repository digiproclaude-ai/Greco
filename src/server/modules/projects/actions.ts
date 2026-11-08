"use server";

import { getLocale } from "next-intl/server";
import { refresh } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { log } from "@/server/log";
import { discardPrivateFile, uploadPrivateFile } from "@/server/modules/attachments/service";
import { echo, failed, succeeded, type ActionState } from "@/server/modules/shared/action-state";
import { clientContext, type UserContext } from "@/server/modules/shared/context";
import { dbErrorKey } from "@/server/modules/shared/db-errors";
import { toFieldErrors } from "@/server/modules/shared/validation";

import {
  declineSchema,
  inviteSchema,
  MAX_PROJECT_ATTACHMENTS,
  newProjectSchema,
  PROJECT_EDITABLE,
  PROJECT_FIELDS,
  projectSchema,
} from "./schemas";

const UUID = /^[0-9a-f-]{36}$/i;

type OwnedProject = { id: string; status: string; currency: string };

/** Relationship + state check: the project belongs to this client (and is editable when asked). */
async function ownedProject(projectId: string, { editable = true } = {}) {
  const ctx = await clientContext();
  if (!ctx || !UUID.test(projectId)) return null;
  const { data } = await ctx.supabase
    .from("projects")
    .select("id, status, currency")
    .eq("id", projectId)
    .eq("client_user_id", ctx.userId)
    .maybeSingle();
  if (!data) return null;
  if (editable && !(PROJECT_EDITABLE as readonly string[]).includes(data.status)) return null;
  return { ctx, project: data as OwnedProject };
}

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await clientContext();
  if (!ctx) return failed("notAllowed");
  const parsed = newProjectSchema.safeParse(Object.fromEntries(formData));
  const values = echo(formData, ["title", "category"]);
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  const id = crypto.randomUUID();
  const { error } = await ctx.supabase
    .from("projects")
    .insert({ id, client_user_id: ctx.userId, title: parsed.data.title, category_id: parsed.data.category });
  if (error) {
    log.warn("projects.create_failed", { code: error.code });
    return failed(dbErrorKey(error), { values });
  }
  return redirect({ href: `/dashboard/client/projects/${id}`, locale: await getLocale() });
}

export async function saveProjectAction(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await ownedProject(projectId);
  if (!scope) return failed("notAllowed");
  const { ctx } = scope;
  const values = echo(formData, PROJECT_FIELDS);
  const parsed = projectSchema.safeParse({ ...Object.fromEntries(formData), terms: [...new Set(formData.getAll("terms").map(String))] });
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  const input = parsed.data;

  const { error } = await ctx.supabase
    .from("projects")
    .update({
      title: input.title,
      description: input.description,
      business_problem: input.businessProblem,
      desired_outcome: input.desiredOutcome,
      category_id: input.category,
      budget_kind: input.budgetKind,
      // Currency is fixed once proposals can arrive, so offers never change currency under an expert.
      ...(scope.project.status === "draft" ? { currency: input.currency } : {}),
      budget_min_minor: input.budgetMinMinor,
      budget_max_minor: input.budgetMaxMinor,
      timeline_kind: input.timelineKind,
      deadline: input.deadline,
      visibility: input.visibility,
    })
    .eq("id", projectId)
    .select("id")
    .single();
  if (error) return failed(dbErrorKey(error), { values });

  const termError = await syncTerms(ctx, projectId, input.terms);
  if (termError) return failed(termError, { values });
  refresh();
  return succeeded();
}

async function syncTerms(ctx: UserContext, projectId: string, wanted: string[]) {
  const { data: current } = await ctx.supabase.from("project_terms").select("term_id").eq("project_id", projectId);
  const existing = new Set((current ?? []).map((row) => row.term_id));
  const next = new Set(wanted);
  const toRemove = [...existing].filter((id) => !next.has(id));
  const toAdd = [...next].filter((id) => !existing.has(id));
  if (toRemove.length > 0) {
    await ctx.supabase.from("project_terms").delete().eq("project_id", projectId).in("term_id", toRemove);
  }
  if (toAdd.length > 0) {
    const { error } = await ctx.supabase.from("project_terms").insert(toAdd.map((termId) => ({ project_id: projectId, term_id: termId })));
    if (error) return dbErrorKey(error);
  }
  return null;
}

export async function publishProjectAction(projectId: string): Promise<ActionState> {
  const scope = await ownedProject(projectId, { editable: false });
  if (!scope) return failed("notAllowed");
  const { data: missing, error } = await scope.ctx.supabase.rpc("projects_publish", { p_project_id: projectId });
  if (error) return failed(dbErrorKey(error));
  if (missing && missing.length > 0) return failed("checklist", { missing });
  refresh();
  return succeeded("published");
}

export async function changeProjectStatusAction(projectId: string, formData: FormData): Promise<void> {
  const scope = await ownedProject(projectId, { editable: false });
  if (!scope) return;
  const action = String(formData.get("action") ?? "");
  if (action !== "close" && action !== "reopen") return;
  const { error } = await scope.ctx.supabase.rpc("projects_change_status", { p_project_id: projectId, p_action: action });
  if (error) log.warn("projects.status_failed", { action, code: error.code });
  refresh();
}

export async function deleteProjectAction(projectId: string): Promise<void> {
  const scope = await ownedProject(projectId, { editable: false });
  if (!scope || scope.project.status !== "draft") return;
  const { data: files } = await scope.ctx.supabase.from("project_attachments").select("file_id").eq("project_id", projectId);
  const { error } = await scope.ctx.supabase.from("projects").delete().eq("id", projectId);
  if (error) {
    log.warn("projects.delete_failed", { code: error.code });
    return;
  }
  for (const row of files ?? []) await discardPrivateFile(scope.ctx, row.file_id);
  return redirect({ href: "/dashboard/client/projects", locale: await getLocale() });
}

// Attachments ------------------------------------------------------------------------------------

export async function uploadProjectAttachmentAction(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await ownedProject(projectId);
  if (!scope) return failed("notAllowed");
  const { count } = await scope.ctx.supabase
    .from("project_attachments")
    .select("file_id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if ((count ?? 0) >= MAX_PROJECT_ATTACHMENTS) return failed("limitReached");

  const upload = await uploadPrivateFile(scope.ctx, formData.get("file"), "project_attachment");
  if ("failure" in upload) return upload.failure;
  const { error } = await scope.ctx.supabase.from("project_attachments").insert({ project_id: projectId, file_id: upload.fileId });
  if (error) {
    await discardPrivateFile(scope.ctx, upload.fileId);
    return failed(dbErrorKey(error));
  }
  refresh();
  return succeeded("uploaded");
}

export async function removeProjectAttachmentAction(projectId: string, formData: FormData): Promise<void> {
  const scope = await ownedProject(projectId);
  if (!scope) return;
  const fileId = String(formData.get("id") ?? "");
  if (!UUID.test(fileId)) return;
  const { error } = await scope.ctx.supabase.from("project_attachments").delete().eq("project_id", projectId).eq("file_id", fileId);
  if (error) {
    log.warn("projects.attachment_remove_failed", { code: error.code });
    return;
  }
  await discardPrivateFile(scope.ctx, fileId);
  refresh();
}

// Invitations and decisions -------------------------------------------------------------------------

export async function inviteExpertAction(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await ownedProject(projectId, { editable: false });
  if (!scope) return failed("notAllowed");
  const values = echo(formData, ["handle", "message"]);
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  if (scope.project.status !== "open") return failed("wrongState", { values });

  const { data: provider } = await scope.ctx.supabase
    .from("providers")
    .select("id")
    .eq("handle", parsed.data.handle)
    .eq("status", "active")
    .maybeSingle();
  if (!provider) return failed("expertNotFound", { values });

  const { error } = await scope.ctx.supabase.rpc("projects_invite", {
    p_project_id: projectId,
    p_provider_id: provider.id,
    p_message: parsed.data.message ?? undefined,
  });
  if (error) return failed(error.code === "23505" ? "alreadyInvited" : dbErrorKey(error), { values });
  refresh();
  return succeeded("invited");
}

/** Client decisions on a proposal: shortlist, unshortlist or decline with an optional reason. */
export async function decideProposalAction(proposalId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await clientContext();
  if (!ctx || !UUID.test(proposalId)) return failed("notAllowed");
  const action = String(formData.get("action") ?? "");
  if (!["shortlist", "unshortlist", "decline"].includes(action)) return failed("invalid");
  const parsed = declineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, ["reason"]) });

  // Relationship check before the database repeats it: the proposal is on one of this client's projects.
  const { data: proposal } = await ctx.supabase
    .from("proposals")
    .select("id, projects!inner (client_user_id)")
    .eq("id", proposalId)
    .eq("projects.client_user_id", ctx.userId)
    .maybeSingle();
  if (!proposal) return failed("notAllowed");

  const { error } = await ctx.supabase.rpc("proposals_decide", {
    p_proposal_id: proposalId,
    p_action: action,
    p_reason: action === "decline" ? (parsed.data.reason ?? undefined) : undefined,
  });
  if (error) return failed(dbErrorKey(error));
  refresh();
  return succeeded("decided");
}
