"use server";

import { getLocale } from "next-intl/server";
import { refresh, revalidateTag } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { parseMoneyToMinor } from "@/lib/money";
import { log } from "@/server/log";
import { discardPublicImage, uploadPublicImage } from "@/server/modules/media/service";
import { echo, failed, succeeded, type ActionState } from "@/server/modules/shared/action-state";
import { expertContext, type ExpertContext } from "@/server/modules/shared/context";
import { dbErrorKey } from "@/server/modules/shared/db-errors";
import { toFieldErrors } from "@/server/modules/shared/validation";
import { getMarketplaceSettings } from "@/server/modules/settings/service";
import { CATALOG_TAG } from "@/server/modules/taxonomy/service";

import {
  ADDON_FIELDS,
  addonSchema,
  altTextSchema,
  BASICS_FIELDS,
  basicsSchema,
  deliverableSchema,
  EDITABLE_STATUSES,
  faqSchema,
  LISTING_LIMITS,
  newListingSchema,
  PACKAGE_FIELDS,
  packageSchema,
  paymentSchema,
  PRICING_FIELDS,
  pricingSchema,
  REQUIREMENT_FIELDS,
  requirementSchema,
  slugify,
} from "./schemas";

type OwnedListing = { id: string; status: string; currency: string; published_at: string | null };

/** Relationship + state check: the listing belongs to this expert and can be edited. */
async function ownedListing(ctx: ExpertContext, listingId: string, { editable = true } = {}): Promise<OwnedListing | null> {
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) return null;
  const { data } = await ctx.supabase
    .from("service_listings")
    .select("id, status, currency, published_at")
    .eq("id", listingId)
    .eq("provider_id", ctx.providerId)
    .maybeSingle();
  if (!data) return null;
  if (editable && !(EDITABLE_STATUSES as readonly string[]).includes(data.status)) return null;
  return data;
}

async function context(listingId: string, options?: { editable?: boolean }) {
  const ctx = await expertContext();
  if (!ctx) return null;
  const listing = await ownedListing(ctx, listingId, options);
  return listing ? { ctx, listing } : null;
}

function changed() {
  revalidateTag(CATALOG_TAG, "max");
  refresh();
}

// Creating ------------------------------------------------------------------------------------

export async function createListingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx) return failed("notAllowed");
  const parsed = newListingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, ["title", "primaryCategory"]) });
  }
  const id = crypto.randomUUID();
  const base = slugify(parsed.data.title);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { error } = await ctx.supabase.from("service_listings").insert({
      id,
      provider_id: ctx.providerId,
      slug,
      title: parsed.data.title,
      primary_category_id: parsed.data.primaryCategory,
    });
    if (!error) return redirect({ href: `/dashboard/expert/services/${id}`, locale: await getLocale() });
    if (error.code !== "23505") {
      log.warn("catalog.create_failed", { code: error.code });
      return failed(dbErrorKey(error), { values: echo(formData, ["title", "primaryCategory"]) });
    }
  }
  return failed("duplicate", { values: echo(formData, ["title", "primaryCategory"]) });
}

// Sections ------------------------------------------------------------------------------------

export async function saveBasicsAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await context(listingId);
  if (!scope) return failed("notAllowed");
  const { ctx } = scope;
  const parsed = basicsSchema.safeParse({ ...Object.fromEntries(formData), terms: [...new Set(formData.getAll("terms").map(String))] });
  if (!parsed.success) {
    return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, BASICS_FIELDS) });
  }
  const input = parsed.data;
  const values = echo(formData, BASICS_FIELDS);

  const { error } = await ctx.supabase
    .from("service_listings")
    .update({
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      description: input.description,
      primary_category_id: input.primaryCategory,
    })
    .eq("id", listingId)
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return failed("duplicate", { values, fieldErrors: { slug: { key: "slug" } } });
    return failed(dbErrorKey(error), { values });
  }

  // Secondary category: at most one besides the primary (the table allows two rows).
  const { data: currentCategories } = await ctx.supabase
    .from("service_listing_categories")
    .select("category_id")
    .eq("listing_id", listingId);
  const stale = (currentCategories ?? []).map((row) => row.category_id).filter((id) => id !== input.secondaryCategory);
  if (stale.length > 0) {
    await ctx.supabase.from("service_listing_categories").delete().eq("listing_id", listingId).in("category_id", stale);
  }
  if (input.secondaryCategory && !(currentCategories ?? []).some((row) => row.category_id === input.secondaryCategory)) {
    const { error: categoryError } = await ctx.supabase
      .from("service_listing_categories")
      .insert({ listing_id: listingId, category_id: input.secondaryCategory });
    if (categoryError) return failed(dbErrorKey(categoryError), { values });
  }

  const { data: currentTerms } = await ctx.supabase.from("service_listing_terms").select("term_id").eq("listing_id", listingId);
  const existing = new Set((currentTerms ?? []).map((row) => row.term_id));
  const wanted = new Set(input.terms);
  const toRemove = [...existing].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !existing.has(id));
  if (toRemove.length > 0) {
    await ctx.supabase.from("service_listing_terms").delete().eq("listing_id", listingId).in("term_id", toRemove);
  }
  if (toAdd.length > 0) {
    const { error: termError } = await ctx.supabase
      .from("service_listing_terms")
      .insert(toAdd.map((termId) => ({ listing_id: listingId, term_id: termId })));
    if (termError) return failed(dbErrorKey(termError), { values });
  }
  changed();
  return succeeded();
}

export async function savePricingAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await context(listingId);
  if (!scope) return failed("notAllowed");
  const parsed = pricingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, PRICING_FIELDS) });
  }
  const input = parsed.data;
  const { error } = await scope.ctx.supabase
    .from("service_listings")
    .update({
      pricing_model: input.pricingModel,
      currency: input.currency,
      fixed_price_minor: input.fixedPriceMinor,
      hourly_rate_minor: input.hourlyRateMinor,
      min_hours: input.pricingModel === "hourly" ? input.minHours : null,
      quote_from_minor: input.quoteFromMinor,
      base_delivery_days: input.pricingModel === "packages" ? null : input.baseDeliveryDays,
      revisions_included: input.revisionsIncluded,
      revision_policy: input.revisionPolicy,
    })
    .eq("id", listingId)
    .select("id")
    .single();
  if (error) return failed(dbErrorKey(error), { values: echo(formData, PRICING_FIELDS) });
  changed();
  return succeeded();
}

export async function savePaymentAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await context(listingId);
  if (!scope) return failed("notAllowed");
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error) });
  const input = parsed.data;
  const settings = await getMarketplaceSettings();
  if (input.paymentModel === "deposit" && !settings.depositAllowedBps.includes(input.depositBps ?? -1)) {
    return failed("invalid", { fieldErrors: { depositBps: { key: "choice" } } });
  }
  const deposit = input.paymentModel === "deposit";
  const { error } = await scope.ctx.supabase
    .from("service_listings")
    .update({
      payment_model: input.paymentModel,
      deposit_bps: deposit ? input.depositBps : null,
      balance_trigger: deposit ? input.balanceTrigger : null,
    })
    .eq("id", listingId)
    .select("id")
    .single();
  if (error) return failed(dbErrorKey(error));
  changed();
  return succeeded();
}

export async function savePackageAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await context(listingId);
  if (!scope) return failed("notAllowed");
  const parsed = packageSchema.safeParse(Object.fromEntries(formData));
  const values = echo(formData, PACKAGE_FIELDS);
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  const priceMinor = parsed.data.price ? parseMoneyToMinor(parsed.data.price, scope.listing.currency) : null;
  if (!priceMinor) return failed("invalid", { fieldErrors: { price: { key: parsed.data.price ? "amount" : "required" } }, values });
  const { error } = await scope.ctx.supabase.from("service_packages").upsert(
    {
      listing_id: listingId,
      tier: parsed.data.tier,
      name: parsed.data.name,
      description: parsed.data.description,
      price_minor: priceMinor,
      delivery_days: parsed.data.deliveryDays,
      revisions_included: parsed.data.revisions,
      is_active: true,
    },
    { onConflict: "listing_id,tier" },
  );
  if (error) return failed(dbErrorKey(error), { values });
  changed();
  return succeeded();
}

/** Remove a child row (package, deliverable, add-on, requirement, FAQ) of an editable listing. */
async function removeChild(
  listingId: string,
  formData: FormData,
  table: "service_packages" | "service_deliverables" | "service_addons" | "service_requirements" | "service_faqs",
) {
  const scope = await context(listingId);
  if (!scope) return;
  const id = String(formData.get("id") ?? "");
  const { error } = await scope.ctx.supabase.from(table).delete().eq("listing_id", listingId).eq("id", id);
  if (error) log.warn("catalog.remove_failed", { table, code: error.code });
  changed();
}

export async function removePackageAction(listingId: string, formData: FormData) {
  await removeChild(listingId, formData, "service_packages");
}

export async function addDeliverableAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await context(listingId);
  if (!scope) return failed("notAllowed");
  const parsed = deliverableSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, ["title"]) });
  const { count } = await scope.ctx.supabase
    .from("service_deliverables")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if ((count ?? 0) >= LISTING_LIMITS.deliverables) return failed("limitReached");
  const { error } = await scope.ctx.supabase
    .from("service_deliverables")
    .insert({ listing_id: listingId, title: parsed.data.title, package_id: parsed.data.packageId, sort_order: count ?? 0 });
  if (error) return failed(dbErrorKey(error), { values: echo(formData, ["title"]) });
  changed();
  return succeeded("added");
}

export async function removeDeliverableAction(listingId: string, formData: FormData) {
  await removeChild(listingId, formData, "service_deliverables");
}

export async function addAddonAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await context(listingId);
  if (!scope) return failed("notAllowed");
  const parsed = addonSchema.safeParse(Object.fromEntries(formData));
  const values = echo(formData, ADDON_FIELDS);
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  const priceMinor = parsed.data.price ? parseMoneyToMinor(parsed.data.price, scope.listing.currency) : null;
  if (!priceMinor) return failed("invalid", { fieldErrors: { price: { key: parsed.data.price ? "amount" : "required" } }, values });
  const { count } = await scope.ctx.supabase
    .from("service_addons")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if ((count ?? 0) >= LISTING_LIMITS.addons) return failed("limitReached");
  const { error } = await scope.ctx.supabase.from("service_addons").insert({
    listing_id: listingId,
    title: parsed.data.title,
    description: parsed.data.description,
    price_minor: priceMinor,
    extra_delivery_days: parsed.data.extraDays ?? 0,
    sort_order: count ?? 0,
  });
  if (error) return failed(dbErrorKey(error), { values });
  changed();
  return succeeded("added");
}

export async function removeAddonAction(listingId: string, formData: FormData) {
  await removeChild(listingId, formData, "service_addons");
}

export async function addRequirementAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await context(listingId);
  if (!scope) return failed("notAllowed");
  const parsed = requirementSchema.safeParse(Object.fromEntries(formData));
  const values = echo(formData, REQUIREMENT_FIELDS);
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  const { count } = await scope.ctx.supabase
    .from("service_requirements")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if ((count ?? 0) >= LISTING_LIMITS.requirements) return failed("limitReached");
  const choiceType = parsed.data.inputType === "choice" || parsed.data.inputType === "multi_choice";
  const { error } = await scope.ctx.supabase.from("service_requirements").insert({
    listing_id: listingId,
    prompt: parsed.data.prompt,
    input_type: parsed.data.inputType,
    options: choiceType ? parsed.data.options : null,
    is_required: parsed.data.isRequired,
    sort_order: count ?? 0,
  });
  if (error) return failed(dbErrorKey(error), { values });
  changed();
  return succeeded("added");
}

export async function removeRequirementAction(listingId: string, formData: FormData) {
  await removeChild(listingId, formData, "service_requirements");
}

export async function addFaqAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await context(listingId);
  if (!scope) return failed("notAllowed");
  const parsed = faqSchema.safeParse(Object.fromEntries(formData));
  const values = echo(formData, ["question", "answer"]);
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values });
  const { count } = await scope.ctx.supabase
    .from("service_faqs")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if ((count ?? 0) >= LISTING_LIMITS.faqs) return failed("limitReached");
  const { error } = await scope.ctx.supabase
    .from("service_faqs")
    .insert({ listing_id: listingId, question: parsed.data.question, answer: parsed.data.answer, sort_order: count ?? 0 });
  if (error) return failed(dbErrorKey(error), { values });
  changed();
  return succeeded("added");
}

export async function removeFaqAction(listingId: string, formData: FormData) {
  await removeChild(listingId, formData, "service_faqs");
}

export async function uploadListingImageAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await context(listingId);
  if (!scope) return failed("notAllowed");
  const alt = altTextSchema.safeParse(Object.fromEntries(formData));
  if (!alt.success) return failed("invalid", { fieldErrors: toFieldErrors(alt.error), values: echo(formData, ["alt"]) });
  const { count } = await scope.ctx.supabase
    .from("service_media")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if ((count ?? 0) >= LISTING_LIMITS.media) return failed("limitReached");

  const upload = await uploadPublicImage(scope.ctx, formData.get("image"), "listing_media");
  if ("failure" in upload) return { ...upload.failure, values: echo(formData, ["alt"]) };

  const { error } = await scope.ctx.supabase
    .from("service_media")
    .insert({ listing_id: listingId, file_id: upload.fileId, alt_text: alt.data.alt, sort_order: count ?? 0 });
  if (error) {
    await discardPublicImage(scope.ctx, upload.fileId);
    return failed(dbErrorKey(error));
  }
  changed();
  return succeeded("uploaded");
}

export async function removeListingImageAction(listingId: string, formData: FormData) {
  const scope = await context(listingId);
  if (!scope) return;
  const id = String(formData.get("id") ?? "");
  const { data: row } = await scope.ctx.supabase
    .from("service_media")
    .select("file_id")
    .eq("id", id)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (!row) return;
  const { error } = await scope.ctx.supabase.from("service_media").delete().eq("id", id);
  if (error) {
    log.warn("catalog.image_remove_failed", { code: error.code });
    return;
  }
  await discardPublicImage(scope.ctx, row.file_id);
  changed();
}

// Lifecycle -------------------------------------------------------------------------------------

export async function submitListingAction(listingId: string): Promise<ActionState> {
  const scope = await context(listingId, { editable: false });
  if (!scope) return failed("notAllowed");
  const { data: missing, error } = await scope.ctx.supabase.rpc("listings_submit_for_review", { p_listing_id: listingId });
  if (error) return failed(dbErrorKey(error));
  if (missing && missing.length > 0) return failed("checklist", { missing });
  changed();
  return succeeded("submitted");
}

export async function changeListingStatusAction(listingId: string, formData: FormData): Promise<void> {
  const scope = await context(listingId, { editable: false });
  if (!scope) return;
  const action = String(formData.get("action") ?? "");
  if (!["pause", "resume", "archive", "restore"].includes(action)) return;
  const { error } = await scope.ctx.supabase.rpc("listings_change_status", { p_listing_id: listingId, p_action: action });
  if (error) log.warn("catalog.status_failed", { action, code: error.code });
  changed();
}

export async function deleteListingAction(listingId: string): Promise<void> {
  const scope = await context(listingId, { editable: false });
  if (!scope || scope.listing.status !== "draft" || scope.listing.published_at) return;
  const { data: media } = await scope.ctx.supabase.from("service_media").select("file_id").eq("listing_id", listingId);
  const { error } = await scope.ctx.supabase.from("service_listings").delete().eq("id", listingId);
  if (error) {
    log.warn("catalog.delete_failed", { code: error.code });
    return;
  }
  for (const row of media ?? []) await discardPublicImage(scope.ctx, row.file_id);
  revalidateTag(CATALOG_TAG, "max");
  return redirect({ href: "/dashboard/expert/services", locale: await getLocale() });
}
