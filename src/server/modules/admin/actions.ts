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
import { checkbox, msg, optionalInt, optionalText, optionalUuid, requiredText, toFieldErrors } from "@/server/modules/shared/validation";
import { CATALOG_TAG, TAXONOMY_TAG } from "@/server/modules/taxonomy/service";

const MODERATORS: StaffRole[] = ["super_admin", "admin", "moderator"];
const ADMINS: StaffRole[] = ["super_admin", "admin"];

const reasonField = optionalText(2000);
const TERM_KINDS = ["skill", "technology", "tool", "framework", "model", "platform", "industry", "use_case"] as const;

function rpcFailure(error: { code?: string; message?: string }, values?: Record<string, string>) {
  if (error.code === "22023" && error.message?.includes("reason")) {
    return failed("invalid", { values, fieldErrors: { reason: { key: "tooShort", values: { min: 10 } } } });
  }
  return failed(dbErrorKey(error), { values });
}

// Moderation ---------------------------------------------------------------------------------------

const decisionSchema = z.object({ decision: z.enum(["approve", "reject"]), reason: reasonField });

export async function decideReviewAction(requestId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext(MODERATORS);
  if (!ctx) return failed("notAllowed");
  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  const values = echo(formData, ["reason"]);
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  if (parsed.data.decision === "reject" && (parsed.data.reason?.length ?? 0) < 10) {
    return failed("invalid", { values, fieldErrors: { reason: { key: "tooShort", values: { min: 10 } } } });
  }
  const { error } = await ctx.supabase.rpc("admin_review", {
    p_request_id: requestId,
    p_decision: parsed.data.decision,
    p_reason: parsed.data.reason ?? undefined,
  });
  if (error) {
    log.warn("admin.review_failed", { code: error.code });
    return rpcFailure(error, values);
  }
  updateTag(CATALOG_TAG);
  return redirect({ href: "/admin/moderation", locale: await getLocale() });
}

const statusSchema = z.object({
  targetType: z.enum(["provider", "listing"]),
  targetId: z.uuid(),
  action: z.enum(["suspend", "reinstate"]),
  reason: reasonField,
});

export async function setContentStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext(MODERATORS);
  if (!ctx) return failed("notAllowed");
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error) });
  if (parsed.data.action === "suspend" && (parsed.data.reason?.length ?? 0) < 10) {
    return failed("invalid", { fieldErrors: { reason: { key: "tooShort", values: { min: 10 } } } });
  }
  const { error } = await ctx.supabase.rpc("admin_set_status", {
    p_target_type: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason ?? undefined,
  });
  if (error) return rpcFailure(error);
  updateTag(CATALOG_TAG);
  refresh();
  return succeeded("statusChanged");
}

// Categories ---------------------------------------------------------------------------------------

const categorySchema = z.object({
  parentId: optionalUuid(),
  slug: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z
      .string()
      .min(1, { error: "required" })
      .max(60, { error: msg("tooLong", { max: 60 }) })
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "slug" }),
  ),
  name: requiredText(1, 80),
  shortDescription: optionalText(160),
  description: optionalText(2000),
  iconKey: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim().toLowerCase() : null),
    z.string().regex(/^[a-z0-9-]{1,40}$/, { error: "slug" }).nullable(),
  ),
  sortOrder: optionalInt(-10000, 10000),
  isVisible: checkbox(),
});

const CATEGORY_FIELDS = ["parentId", "slug", "name", "shortDescription", "description", "iconKey", "sortOrder"] as const;

function taxonomyChanged() {
  updateTag(TAXONOMY_TAG);
  updateTag(CATALOG_TAG);
}

export async function saveCategoryAction(categoryId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext(ADMINS);
  if (!ctx) return failed("notAllowed");
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  const values = echo(formData, CATEGORY_FIELDS);
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  const input = parsed.data;
  if (categoryId && input.parentId === categoryId) {
    return failed("invalid", { values, fieldErrors: { parentId: { key: "choice" } } });
  }
  const { data: id, error } = await ctx.supabase.rpc("admin_save_category", {
    p_id: categoryId ?? (null as unknown as string),
    p_parent_id: input.parentId ?? (null as unknown as string),
    p_slug: input.slug,
    p_name: input.name,
    p_short_description: input.shortDescription ?? undefined,
    p_description: input.description ?? undefined,
    p_icon_key: input.iconKey ?? undefined,
    p_sort_order: input.sortOrder ?? 0,
    p_is_visible: input.isVisible,
  });
  if (error) {
    log.warn("admin.category_failed", { code: error.code });
    if (error.code === "23505") return failed("duplicate", { values, fieldErrors: { slug: { key: "slug" } } });
    return failed(dbErrorKey(error), { values });
  }
  taxonomyChanged();
  if (!categoryId) return redirect({ href: `/admin/categories/${id}`, locale: await getLocale() });
  refresh();
  return succeeded();
}

export async function setCategoryActiveAction(formData: FormData): Promise<void> {
  const ctx = await staffContext(ADMINS);
  const parsed = z.object({ id: z.uuid(), active: z.enum(["0", "1"]) }).safeParse(Object.fromEntries(formData));
  if (!ctx || !parsed.success) return;
  const { error } = await ctx.supabase.rpc("admin_set_category_active", { p_id: parsed.data.id, p_active: parsed.data.active === "1" });
  if (error) log.warn("admin.category_active_failed", { code: error.code });
  taxonomyChanged();
  refresh();
}

export async function reassignCategoryAction(fromId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext(ADMINS);
  if (!ctx) return failed("notAllowed");
  const parsed = z.object({ target: z.uuid({ error: "choice" }) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error) });
  const { error } = await ctx.supabase.rpc("admin_reassign_category_listings", { p_from: fromId, p_to: parsed.data.target });
  if (error) return failed(dbErrorKey(error));
  taxonomyChanged();
  refresh();
  return succeeded("statusChanged");
}

// Taxonomy -----------------------------------------------------------------------------------------

const termSchema = z.object({
  kind: z.enum(TERM_KINDS, { error: "choice" }),
  slug: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z
      .string()
      .min(1, { error: "required" })
      .max(60, { error: msg("tooLong", { max: 60 }) })
      .regex(/^[a-z0-9]+([-.+][a-z0-9]+)*$/, { error: "slug" }),
  ),
  name: requiredText(1, 80),
  description: optionalText(500),
  aliases: z.preprocess(
    (v) =>
      typeof v === "string"
        ? [...new Set(v.split(",").map((a) => a.trim()).filter(Boolean))]
        : [],
    z.array(z.string().max(60, { error: msg("tooLong", { max: 60 }) })).max(30, { error: msg("tooMany", { max: 30 }) }),
  ),
});

const TERM_FIELDS = ["kind", "slug", "name", "description", "aliases"] as const;

export async function saveTermAction(termId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext(MODERATORS);
  if (!ctx) return failed("notAllowed");
  const parsed = termSchema.safeParse(Object.fromEntries(formData));
  const values = echo(formData, TERM_FIELDS);
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  const { error } = await ctx.supabase.rpc("admin_save_term", {
    p_id: termId ?? (null as unknown as string),
    p_kind: parsed.data.kind,
    p_slug: parsed.data.slug,
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? undefined,
    p_aliases: parsed.data.aliases,
  });
  if (error) {
    log.warn("admin.term_failed", { code: error.code });
    if (error.code === "23505") return failed("duplicate", { values, fieldErrors: { slug: { key: "slug" } } });
    return failed(dbErrorKey(error), { values });
  }
  taxonomyChanged();
  if (!termId) return redirect({ href: "/admin/taxonomy", locale: await getLocale() });
  refresh();
  return succeeded();
}

export async function setTermStatusAction(formData: FormData): Promise<void> {
  const ctx = await staffContext(MODERATORS);
  const parsed = z.object({ id: z.uuid(), status: z.enum(["active", "retired"]) }).safeParse(Object.fromEntries(formData));
  if (!ctx || !parsed.success) return;
  const { error } = await ctx.supabase.rpc("admin_set_term_status", { p_id: parsed.data.id, p_status: parsed.data.status });
  if (error) log.warn("admin.term_status_failed", { code: error.code });
  taxonomyChanged();
  refresh();
}

export async function mergeTermAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext(MODERATORS);
  if (!ctx) return failed("notAllowed");
  const parsed = z.object({ from: z.uuid(), into: z.uuid({ error: "choice" }) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error) });
  const { error } = await ctx.supabase.rpc("admin_merge_term", { p_from: parsed.data.from, p_into: parsed.data.into });
  if (error) return failed(dbErrorKey(error));
  taxonomyChanged();
  return redirect({ href: "/admin/taxonomy", locale: await getLocale() });
}
