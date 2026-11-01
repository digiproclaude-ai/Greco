import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "@/server/db/supabase-server";
import type { Enums, Tables } from "@/server/db/types";

export type MarketplaceRole = Enums<"marketplace_role">;
export type StaffRole = Enums<"staff_role">;

export type Account = {
  userId: string;
  email: string | null;
  /** Authenticator assurance level of this session: aal2 means MFA was completed. */
  aal: "aal1" | "aal2";
  profile: Pick<
    Tables<"profiles">,
    "full_name" | "display_name" | "active_role" | "account_status" | "country_code" | "locale" | "timezone"
  >;
  roles: { role: MarketplaceRole; status: Enums<"role_status"> }[];
  staffRoles: StaffRole[];
  provider: Pick<Tables<"providers">, "id" | "status" | "handle" | "display_name"> | null;
  hasAcceptedLegal: boolean;
};

/** Verified identity of the current request (JWT checked by Supabase), or null. */
export const getSessionClaims = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims;
  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    aal: claims.aal === "aal2" ? ("aal2" as const) : ("aal1" as const),
  };
});

/**
 * The signed-in account with roles and status, read under RLS. Deduplicated per request.
 * Returns null when signed out or when the profile cannot be loaded.
 */
export const getAccount = cache(async (): Promise<Account | null> => {
  const session = await getSessionClaims();
  if (!session) return null;
  const { supabase, userId } = session;

  const [profileResult, rolesResult, staffResult, providerResult, legalResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, display_name, active_role, account_status, country_code, locale, timezone")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role, status").eq("user_id", userId),
    supabase.from("staff_roles").select("role").eq("user_id", userId).is("revoked_at", null),
    supabase
      .from("providers")
      .select("id, status, handle, display_name")
      .eq("owner_user_id", userId)
      .maybeSingle(),
    supabase.rpc("has_accepted_current_legal"),
  ]);

  if (!profileResult.data) return null;

  return {
    userId,
    email: session.email,
    aal: session.aal,
    profile: profileResult.data,
    roles: rolesResult.data ?? [],
    staffRoles: (staffResult.data ?? []).map((row) => row.role),
    provider: providerResult.data ?? null,
    hasAcceptedLegal: legalResult.data === true,
  };
});

export function hasActiveRole(account: Account, role: MarketplaceRole): boolean {
  return account.roles.some((entry) => entry.role === role && entry.status === "active");
}

export function displayNameOf(account: Account): string {
  return account.profile.display_name ?? account.profile.full_name;
}
