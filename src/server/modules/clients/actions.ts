"use server";

import { refresh } from "next/cache";

import { log } from "@/server/log";
import { echo, failed, succeeded, type ActionState } from "@/server/modules/shared/action-state";
import { clientContext } from "@/server/modules/shared/context";
import { dbErrorKey } from "@/server/modules/shared/db-errors";
import { toFieldErrors } from "@/server/modules/shared/validation";

import { CLIENT_FIELDS, clientProfileSchema } from "./schemas";

export async function saveClientProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await clientContext();
  if (!ctx) return failed("notAllowed");
  const parsed = clientProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failed("invalid", { fieldErrors: toFieldErrors(parsed.error), values: echo(formData, CLIENT_FIELDS) });
  }
  const input = parsed.data;
  const business = input.accountType === "business";
  const { error } = await ctx.supabase
    .from("client_profiles")
    .update({
      account_type: input.accountType,
      business_name: business ? input.businessName : null,
      industry_term_id: input.industry,
      company_size: business ? input.companySize : null,
      website_url: input.website,
      purpose: input.purpose,
      challenges: input.challenges,
    })
    .eq("user_id", ctx.userId)
    .select("user_id")
    .single();
  if (error) {
    log.warn("clients.save_failed", { code: error.code });
    return failed(dbErrorKey(error), { values: echo(formData, CLIENT_FIELDS) });
  }
  const { error: completeError } = await ctx.supabase.rpc("client_complete_onboarding");
  if (completeError) log.warn("clients.complete_failed", { code: completeError.code });
  refresh();
  return succeeded();
}
