import "server-only";

import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { redirect } from "@/i18n/navigation";

import {
  getAccount,
  getSessionClaims,
  hasActiveRole,
  type Account,
  type MarketplaceRole,
  type StaffRole,
} from "./session";

async function go(href: string): Promise<never> {
  const locale = await getLocale();
  return redirect({ href, locale });
}

function withNext(path: string, next?: string) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

/**
 * Require a signed-in, active account that has accepted the current legal documents.
 * Pass `next` so the user returns to the same page after logging in.
 */
export async function requireUser(next?: string): Promise<Account> {
  const account = await getAccount();
  if (!account) return go(withNext("/login", next));
  if (account.profile.account_status !== "active") return go("/account-unavailable");
  if (!account.hasAcceptedLegal) return go(withNext("/accept-terms", next));
  return account;
}

/** Capability check: the role must be enabled and not suspended (ARCHITECTURE.md §8.2). */
export async function requireRole(role: MarketplaceRole, next?: string): Promise<Account> {
  const account = await requireUser(next);
  if (!hasActiveRole(account, role)) return go("/dashboard");
  return account;
}

/**
 * Staff areas need a staff role AND a session that completed MFA (aal2). Non-staff get a 404 so
 * the admin area's existence isn't confirmed.
 */
export async function requireStaff(roles?: StaffRole[], next = "/admin"): Promise<Account> {
  const account = await requireUser(next);
  const allowed = roles ? account.staffRoles.filter((role) => roles.includes(role)) : account.staffRoles;
  if (allowed.length === 0) notFound();

  if (account.aal !== "aal2") {
    const session = await getSessionClaims();
    const { data } = (await session?.supabase.auth.mfa.listFactors()) ?? { data: null };
    const hasVerifiedFactor = (data?.totp ?? []).some((factor) => factor.status === "verified");
    return go(hasVerifiedFactor ? withNext("/mfa", next) : "/dashboard/settings/security?mfa=required");
  }
  return account;
}
