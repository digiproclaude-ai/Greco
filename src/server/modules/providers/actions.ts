"use server";

import { refresh, revalidateTag } from "next/cache";

import { log } from "@/server/log";
import { discardPublicImage, uploadPublicImage } from "@/server/modules/media/service";
import { echo, failed, succeeded, type ActionState } from "@/server/modules/shared/action-state";
import { expertContext } from "@/server/modules/shared/context";
import { dbErrorKey } from "@/server/modules/shared/db-errors";
import { toFieldErrors } from "@/server/modules/shared/validation";
import { CATALOG_TAG } from "@/server/modules/taxonomy/service";

import { z } from "zod";

import { requiredText } from "@/server/modules/shared/validation";

import {
  AGENCY_FIELDS,
  agencySchema,
  handleSchema,
  languageSchema,
  linkSchema,
  PROFILE_FIELDS,
  profileSchema,
  termsSchema,
} from "./schemas";

function changed() {
  revalidateTag(CATALOG_TAG, "max");
  refresh();
}

export async function saveProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx) return failed("notAllowed");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, PROFILE_FIELDS) });
  }
  const input = parsed.data;
  const { error } = await ctx.supabase
    .from("providers")
    .update({
      provider_type: input.providerType,
      display_name: input.displayName,
      headline: input.headline,
      bio: input.bio,
      country_code: input.country,
      city: input.city,
      timezone: input.timezone,
      experience_level: input.experienceLevel,
      years_experience: input.yearsExperience,
      availability: input.availability,
      availability_note: input.availabilityNote,
      indicative_hourly_rate_minor: input.rateMinor,
      rate_currency: input.rateMinor === null ? null : input.rateCurrency,
      website_url: input.website,
    })
    .eq("id", ctx.providerId)
    .select("id")
    .single();
  if (error) {
    log.warn("providers.save_failed", { code: error.code });
    return failed(dbErrorKey(error), { values: echo(formData, PROFILE_FIELDS) });
  }
  changed();
  return succeeded();
}

export async function setHandleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx) return failed("notAllowed");
  const parsed = handleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, ["handle"]) });
  }
  const { error } = await ctx.supabase.rpc("providers_set_handle", { p_handle: parsed.data.handle });
  if (error) {
    const values = echo(formData, ["handle"]);
    if (error.message.includes("reserved")) return failed("handleReserved", { values });
    if (error.code === "23505" || error.message.includes("taken")) return failed("handleTaken", { values });
    if (error.code === "22023") return failed("invalid", { values, fieldErrors: { handle: { key: "handle" } } });
    return failed(dbErrorKey(error), { values });
  }
  changed();
  return succeeded();
}

export async function saveAgencyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx) return failed("notAllowed");
  const parsed = agencySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, AGENCY_FIELDS) });
  }
  const input = parsed.data;
  const { error } = await ctx.supabase.from("provider_agency_details").upsert(
    {
      provider_id: ctx.providerId,
      founded_year: input.foundedYear,
      team_size_range: input.teamSize,
      office_locations: input.offices.length > 0 ? input.offices : null,
      legal_name: input.legalName,
      registration_number: input.registrationNumber,
    },
    { onConflict: "provider_id" },
  );
  if (error) {
    log.warn("providers.agency_failed", { code: error.code });
    return failed(dbErrorKey(error), { values: echo(formData, AGENCY_FIELDS) });
  }
  changed();
  return succeeded();
}

export async function saveTermsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx) return failed("notAllowed");
  const parsed = termsSchema.safeParse({ terms: [...new Set(formData.getAll("terms").map(String))] });
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error) });

  const { data: current, error: readError } = await ctx.supabase
    .from("provider_terms")
    .select("term_id")
    .eq("provider_id", ctx.providerId);
  if (readError) return failed(dbErrorKey(readError));

  const wanted = new Set(parsed.data.terms);
  const existing = new Set((current ?? []).map((row) => row.term_id));
  const toRemove = [...existing].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !existing.has(id));

  if (toRemove.length > 0) {
    const { error } = await ctx.supabase.from("provider_terms").delete().eq("provider_id", ctx.providerId).in("term_id", toRemove);
    if (error) return failed(dbErrorKey(error));
  }
  if (toAdd.length > 0) {
    const { error } = await ctx.supabase
      .from("provider_terms")
      .insert(toAdd.map((termId) => ({ provider_id: ctx.providerId, term_id: termId })));
    if (error) {
      log.warn("providers.terms_failed", { code: error.code });
      return failed(dbErrorKey(error));
    }
  }
  changed();
  return succeeded();
}

export async function addLanguageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx) return failed("notAllowed");
  const parsed = languageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed("invalid", { fieldErrors: toFieldErrors(parsed.error) });
  const { error } = await ctx.supabase.from("provider_languages").upsert(
    { provider_id: ctx.providerId, language_code: parsed.data.language, proficiency: parsed.data.proficiency },
    { onConflict: "provider_id,language_code" },
  );
  if (error) return failed(dbErrorKey(error));
  changed();
  return succeeded("added");
}

export async function removeLanguageAction(formData: FormData): Promise<void> {
  const ctx = await expertContext();
  if (!ctx) return;
  const code = String(formData.get("language") ?? "");
  const { error } = await ctx.supabase
    .from("provider_languages")
    .delete()
    .eq("provider_id", ctx.providerId)
    .eq("language_code", code);
  if (error) log.warn("providers.language_remove_failed", { code: error.code });
  changed();
}

export async function addLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx) return failed("notAllowed");
  const parsed = linkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, ["kind", "url"]) });
  }
  const { error } = await ctx.supabase
    .from("provider_links")
    .insert({ provider_id: ctx.providerId, kind: parsed.data.kind, url: parsed.data.url });
  if (error) return failed(dbErrorKey(error), { values: echo(formData, ["kind", "url"]) });
  changed();
  return succeeded("added");
}

export async function removeLinkAction(formData: FormData): Promise<void> {
  const ctx = await expertContext();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  const { error } = await ctx.supabase.from("provider_links").delete().eq("provider_id", ctx.providerId).eq("id", id);
  if (error) log.warn("providers.link_remove_failed", { code: error.code });
  changed();
}

export async function uploadAvatarAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx) return failed("notAllowed");
  const { data: current } = await ctx.supabase.from("providers").select("avatar_file_id").eq("id", ctx.providerId).single();

  const upload = await uploadPublicImage(ctx, formData.get("avatar"), "avatar");
  if ("failure" in upload) return upload.failure;

  const { error } = await ctx.supabase.rpc("providers_set_avatar", { p_file_id: upload.fileId });
  if (error) {
    await discardPublicImage(ctx, upload.fileId);
    return failed(dbErrorKey(error));
  }
  await discardPublicImage(ctx, current?.avatar_file_id);
  changed();
  return succeeded("uploaded");
}

export async function removeAvatarAction(): Promise<void> {
  const ctx = await expertContext();
  if (!ctx) return;
  const { data: current } = await ctx.supabase.from("providers").select("avatar_file_id").eq("id", ctx.providerId).single();
  const { error } = await ctx.supabase.rpc("providers_set_avatar", { p_file_id: null as unknown as string });
  if (error) {
    log.warn("providers.avatar_remove_failed", { code: error.code });
    return;
  }
  await discardPublicImage(ctx, current?.avatar_file_id);
  changed();
}

export async function submitProfileAction(): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx) return failed("notAllowed");
  const { data: missing, error } = await ctx.supabase.rpc("providers_submit_for_review");
  if (error) return failed(dbErrorKey(error));
  if (missing && missing.length > 0) return failed("checklist", { missing });
  refresh();
  return succeeded("submitted");
}

const suggestionSchema = z.object({
  kind: z.enum(["skill", "technology", "industry"], { error: "choice" }),
  name: requiredText(2, 60),
});

/** Experts suggest a missing skill, technology or industry; moderators approve or merge it. */
export async function suggestTermAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await expertContext();
  if (!ctx) return failed("notAllowed");
  const parsed = suggestionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, ["kind", "name"]) });
  }
  const { error } = await ctx.supabase.rpc("suggest_taxonomy_term", { p_kind: parsed.data.kind, p_name: parsed.data.name });
  if (error) return failed(dbErrorKey(error), { values: echo(formData, ["kind", "name"]) });
  return succeeded("suggested");
}
