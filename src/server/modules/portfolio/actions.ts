"use server";

import { getLocale } from "next-intl/server";
import { refresh, revalidateTag } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { log } from "@/server/log";
import { discardPublicImage, uploadPublicImage } from "@/server/modules/media/service";
import { echo, failed, succeeded, type ActionState } from "@/server/modules/shared/action-state";
import { expertContext, type ExpertContext } from "@/server/modules/shared/context";
import { dbErrorKey } from "@/server/modules/shared/db-errors";
import { toFieldErrors } from "@/server/modules/shared/validation";
import { CATALOG_TAG } from "@/server/modules/taxonomy/service";

import { captionSchema, MAX_PORTFOLIO_IMAGES, PORTFOLIO_FIELDS, portfolioItemSchema } from "./schemas";

function parseItem(formData: FormData) {
  return portfolioItemSchema.safeParse({
    ...Object.fromEntries(formData),
    terms: [...new Set(formData.getAll("terms").map(String))],
  });
}

function rowFrom(input: ReturnType<typeof portfolioItemSchema.parse>) {
  return {
    title: input.title,
    summary: input.summary,
    problem: input.problem,
    solution: input.solution,
    results: input.results,
    role: input.role,
    client_display_name: input.clientName,
    industry_term_id: input.industry,
    project_date: input.projectMonth ? `${input.projectMonth}-01` : null,
    external_url: input.externalUrl,
    status: input.status,
  };
}

async function syncTerms(ctx: ExpertContext, itemId: string, wanted: string[]) {
  const { data: current } = await ctx.supabase.from("portfolio_item_terms").select("term_id").eq("item_id", itemId);
  const existing = new Set((current ?? []).map((row) => row.term_id));
  const want = new Set(wanted);
  const toRemove = [...existing].filter((id) => !want.has(id));
  const toAdd = [...want].filter((id) => !existing.has(id));
  if (toRemove.length > 0) {
    const { error } = await ctx.supabase.from("portfolio_item_terms").delete().eq("item_id", itemId).in("term_id", toRemove);
    if (error) return error;
  }
  if (toAdd.length > 0) {
    const { error } = await ctx.supabase.from("portfolio_item_terms").insert(toAdd.map((termId) => ({ item_id: itemId, term_id: termId })));
    if (error) return error;
  }
  return null;
}

async function ownsItem(ctx: ExpertContext, itemId: string) {
  const { data } = await ctx.supabase
    .from("portfolio_items")
    .select("id")
    .eq("id", itemId)
    .eq("provider_id", ctx.providerId)
    .eq("provenance", "self_reported")
    .maybeSingle();
  return Boolean(data);
}

export async function createPortfolioItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx) return failed("notAllowed");
  const parsed = parseItem(formData);
  if (!parsed.success) {
    return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, PORTFOLIO_FIELDS) });
  }
  const id = crypto.randomUUID();
  const { error } = await ctx.supabase.from("portfolio_items").insert({ id, provider_id: ctx.providerId, ...rowFrom(parsed.data) });
  if (error) {
    log.warn("portfolio.create_failed", { code: error.code });
    return failed(dbErrorKey(error), { values: echo(formData, PORTFOLIO_FIELDS) });
  }
  const termError = await syncTerms(ctx, id, parsed.data.terms);
  if (termError) log.warn("portfolio.terms_failed", { code: termError.code });
  revalidateTag(CATALOG_TAG, "max");
  return redirect({ href: `/dashboard/expert/portfolio/${id}`, locale: await getLocale() });
}

export async function savePortfolioItemAction(itemId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx || !(await ownsItem(ctx, itemId))) return failed("notAllowed");
  const parsed = parseItem(formData);
  if (!parsed.success) {
    return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, PORTFOLIO_FIELDS) });
  }
  const { error } = await ctx.supabase
    .from("portfolio_items")
    .update(rowFrom(parsed.data))
    .eq("id", itemId)
    .select("id")
    .single();
  if (error) return failed(dbErrorKey(error), { values: echo(formData, PORTFOLIO_FIELDS) });
  const termError = await syncTerms(ctx, itemId, parsed.data.terms);
  if (termError) return failed(dbErrorKey(termError));
  revalidateTag(CATALOG_TAG, "max");
  refresh();
  return succeeded();
}

export async function deletePortfolioItemAction(itemId: string): Promise<void> {
  const ctx = await expertContext();
  if (!ctx || !(await ownsItem(ctx, itemId))) return;
  const { data: media } = await ctx.supabase.from("portfolio_item_media").select("file_id").eq("item_id", itemId);
  const { error } = await ctx.supabase.from("portfolio_items").delete().eq("id", itemId);
  if (error) {
    log.warn("portfolio.delete_failed", { code: error.code });
    return;
  }
  for (const row of media ?? []) await discardPublicImage(ctx, row.file_id);
  revalidateTag(CATALOG_TAG, "max");
  return redirect({ href: "/dashboard/expert/portfolio", locale: await getLocale() });
}

export async function uploadPortfolioImageAction(itemId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx || !(await ownsItem(ctx, itemId))) return failed("notAllowed");
  const caption = captionSchema.safeParse(Object.fromEntries(formData));
  if (!caption.success) return failed("invalid", { fieldErrors: toFieldErrors(caption.error) });

  const { count } = await ctx.supabase
    .from("portfolio_item_media")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId);
  if ((count ?? 0) >= MAX_PORTFOLIO_IMAGES) return failed("limitReached");

  const upload = await uploadPublicImage(ctx, formData.get("image"), "portfolio_media");
  if ("failure" in upload) return upload.failure;

  const { error } = await ctx.supabase
    .from("portfolio_item_media")
    .insert({ item_id: itemId, file_id: upload.fileId, caption: caption.data.caption, sort_order: count ?? 0 });
  if (error) {
    await discardPublicImage(ctx, upload.fileId);
    return failed(dbErrorKey(error));
  }
  revalidateTag(CATALOG_TAG, "max");
  refresh();
  return succeeded("uploaded");
}

export async function removePortfolioImageAction(itemId: string, formData: FormData): Promise<void> {
  const ctx = await expertContext();
  if (!ctx || !(await ownsItem(ctx, itemId))) return;
  const mediaId = String(formData.get("mediaId") ?? "");
  const { data: row } = await ctx.supabase
    .from("portfolio_item_media")
    .select("file_id")
    .eq("id", mediaId)
    .eq("item_id", itemId)
    .maybeSingle();
  if (!row) return;
  const { error } = await ctx.supabase.from("portfolio_item_media").delete().eq("id", mediaId);
  if (error) {
    log.warn("portfolio.image_remove_failed", { code: error.code });
    return;
  }
  await discardPublicImage(ctx, row.file_id);
  revalidateTag(CATALOG_TAG, "max");
  refresh();
}
