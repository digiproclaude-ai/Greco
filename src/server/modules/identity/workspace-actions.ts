"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";

import { redirect } from "@/i18n/navigation";
import { getSessionClaims } from "@/server/auth/session";
import { log } from "@/server/log";

const roleSchema = z.enum(["client", "expert"]);

async function go(href: string): Promise<never> {
  return redirect({ href, locale: await getLocale() });
}

/**
 * Switch the workspace, enabling the role first if needed. The database functions check that
 * the account is active and the role isn't suspended (see the security migration).
 */
export async function switchWorkspaceAction(formData: FormData): Promise<void> {
  const parsed = roleSchema.safeParse(formData.get("role"));
  if (!parsed.success) return go("/dashboard");

  const session = await getSessionClaims();
  if (!session) return go("/login");

  if (formData.get("enable") === "1") {
    const { error } = await session.supabase.rpc("enable_marketplace_role", { p_role: parsed.data });
    if (error) {
      log.warn("identity.enable_role_failed", { code: error.code });
      return go("/dashboard?error=workspace");
    }
  }

  const { error } = await session.supabase.rpc("switch_active_role", { p_role: parsed.data });
  if (error) {
    log.warn("identity.switch_role_failed", { code: error.code });
    return go("/dashboard?error=workspace");
  }
  return go(`/dashboard/${parsed.data}`);
}
