import "server-only";

import { getAccount, getSessionClaims, hasActiveRole, type Account, type StaffRole } from "@/server/auth/session";

/**
 * Authorization context for Server Actions (CLAUDE.md: capability + relationship + state in
 * every action; RLS and database functions check again). Returns null instead of redirecting so
 * actions can answer their form with a "not allowed" message.
 */
export async function userContext() {
  const [account, session] = await Promise.all([getAccount(), getSessionClaims()]);
  if (!account || !session) return null;
  if (account.profile.account_status !== "active" || !account.hasAcceptedLegal) return null;
  return { account, supabase: session.supabase, userId: account.userId };
}

export type UserContext = NonNullable<Awaited<ReturnType<typeof userContext>>>;

export async function expertContext() {
  const ctx = await userContext();
  if (!ctx || !hasActiveRole(ctx.account, "expert") || !ctx.account.provider) return null;
  const provider = ctx.account.provider;
  if (provider.status === "suspended" || provider.status === "deactivated") return null;
  return { ...ctx, provider, providerId: provider.id };
}

export type ExpertContext = NonNullable<Awaited<ReturnType<typeof expertContext>>>;

export async function clientContext() {
  const ctx = await userContext();
  if (!ctx || !hasActiveRole(ctx.account, "client")) return null;
  return ctx;
}

/** Staff actions need a matching staff role and an MFA (aal2) session. */
export async function staffContext(roles: StaffRole[]) {
  const ctx = await userContext();
  if (!ctx || ctx.account.aal !== "aal2") return null;
  if (!ctx.account.staffRoles.some((role) => roles.includes(role))) return null;
  return ctx;
}

export function isStaff(account: Account, roles?: StaffRole[]) {
  return account.staffRoles.some((role) => !roles || roles.includes(role));
}
