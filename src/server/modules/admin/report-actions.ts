"use server";

import { getLocale } from "next-intl/server";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { redirect } from "@/i18n/navigation";
import type { StaffRole } from "@/server/auth/session";
import { log } from "@/server/log";
import { echo, failed, succeeded, type ActionState } from "@/server/modules/shared/action-state";
import { staffContext } from "@/server/modules/shared/context";
import { dbErrorKey } from "@/server/modules/shared/db-errors";
import { optionalText, toFieldErrors } from "@/server/modules/shared/validation";
import { CATALOG_TAG } from "@/server/modules/taxonomy/service";

const MODERATORS: StaffRole[] = ["super_admin", "admin", "moderator"];
const UUID = /^[0-9a-f-]{36}$/i;

const resolveSchema = z.object({ outcome: z.enum(["dismissed", "actioned"], { error: "choice" }), note: optionalText(2000) });
const moderateSchema = z.object({ action: z.enum(["remove", "restore"], { error: "choice" }), reason: optionalText(2000) });

function needsReason(action: string, reason: string | null) {
  return action === "remove" && (reason?.length ?? 0) < 10;
}

export async function resolveReportAction(reportId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext(MODERATORS);
  if (!ctx || !UUID.test(reportId)) return failed("notAllowed");
  const parsed = resolveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, ["note"]) });
  const { error } = await ctx.supabase.rpc("admin_resolve_report", {
    p_report_id: reportId,
    p_outcome: parsed.data.outcome,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) {
    log.warn("admin.report_resolve_failed", { code: error.code });
    return failed(dbErrorKey(error), { values: echo(formData, ["note"]) });
  }
  return redirect({ href: "/admin/reports", locale: await getLocale() });
}

export async function moderateMessageAction(reportId: string, messageId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext(MODERATORS);
  if (!ctx || !UUID.test(reportId) || !UUID.test(messageId)) return failed("notAllowed");
  const parsed = moderateSchema.safeParse(Object.fromEntries(formData));
  const values = echo(formData, ["reason"]);
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  if (needsReason(parsed.data.action, parsed.data.reason)) {
    return failed("invalid", { values, fieldErrors: { reason: { key: "tooShort", values: { min: 10 } } } });
  }
  const { error } = await ctx.supabase.rpc("admin_moderate_message", {
    p_message_id: messageId,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason ?? undefined,
    p_report_id: reportId,
  });
  if (error) return failed(dbErrorKey(error), { values });
  refresh();
  return succeeded("statusChanged");
}

export async function setProjectStatusAction(reportId: string, projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext(MODERATORS);
  if (!ctx || !UUID.test(reportId) || !UUID.test(projectId)) return failed("notAllowed");
  const parsed = moderateSchema.safeParse(Object.fromEntries(formData));
  const values = echo(formData, ["reason"]);
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  if (needsReason(parsed.data.action, parsed.data.reason)) {
    return failed("invalid", { values, fieldErrors: { reason: { key: "tooShort", values: { min: 10 } } } });
  }
  const { error } = await ctx.supabase.rpc("admin_set_project_status", {
    p_project_id: projectId,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason ?? undefined,
    p_report_id: reportId,
  });
  if (error) return failed(dbErrorKey(error), { values });
  updateTag(CATALOG_TAG);
  refresh();
  return succeeded("statusChanged");
}
