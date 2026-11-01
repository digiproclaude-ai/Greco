"use server";

import { cookies } from "next/headers";
import { redirect as externalRedirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { getPublicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { getSessionClaims } from "@/server/auth/session";
import { createSupabaseAnonClient, createSupabaseServerClient } from "@/server/db/supabase-server";
import { log } from "@/server/log";

import { authErrorKey } from "./auth-errors";
import { SIGNUP_INTENT_COOKIE } from "./constants";
import type { FormState } from "./form-state";
import {
  forgotPasswordSchema,
  googleSignupSchema,
  loginSchema,
  mfaCodeSchema,
  registerSchema,
  resetPasswordSchema,
  toFieldErrors,
} from "./schemas";

async function go(href: string): Promise<never> {
  return redirect({ href, locale: await getLocale() });
}

function callbackUrl(next: string) {
  return `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`;
}

async function signupsEnabled(): Promise<boolean> {
  const { data } = await createSupabaseAnonClient()
    .from("platform_settings")
    .select("value")
    .eq("key", "signups.enabled")
    .maybeSingle();
  return data?.value !== false;
}

async function countryAllowed(code: string): Promise<boolean> {
  const { data } = await createSupabaseAnonClient()
    .from("countries")
    .select("can_register")
    .eq("code", code)
    .maybeSingle();
  return data?.can_register === true;
}

// Registration ----------------------------------------------------------------

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const values = {
    fullName: String(raw.fullName ?? ""),
    email: String(raw.email ?? ""),
    country: String(raw.country ?? ""),
    role: String(raw.role ?? ""),
  };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  }
  const input = parsed.data;

  if (!(await signupsEnabled())) return { status: "error", error: "generic", values };
  if (!(await countryAllowed(input.country))) {
    return { status: "error", fieldErrors: { country: { key: "country" } }, values };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: callbackUrl("/dashboard"),
      // Validated again by the database trigger (DATABASE_SCHEMA.md §3); never trusted for privileges.
      data: {
        full_name: input.fullName,
        country_code: input.country,
        initial_role: input.role,
        legal_accepted: "true",
        locale: await getLocale(),
      },
    },
  });

  if (error) {
    log.warn("auth.signup_failed", { code: error.code, status: error.status });
    return { status: "error", error: authErrorKey(error), values };
  }
  return go("/check-email");
}

// Login -------------------------------------------------------------------------

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const values = { email: String(raw.email ?? "") };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const next = safeNextPath(parsed.data.next);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    log.info("auth.login_failed", { code: error.code, status: error.status });
    return { status: "error", error: authErrorKey(error), values };
  }

  // Users who enrolled an authenticator must complete the second step.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return go(`/mfa?next=${encodeURIComponent(next)}`);
  }
  return go(next);
}

/**
 * Google sign-in. From the registration form it also carries the chosen role and the legal
 * acceptance, which the callback applies once the account exists.
 */
export async function googleSignInAction(formData: FormData): Promise<void> {
  if (!getPublicEnv().NEXT_PUBLIC_AUTH_GOOGLE_ENABLED) return go("/login");

  const intent = formData.get("intent");
  if (intent === "register") {
    const parsed = googleSignupSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return go(`/register?google=incomplete`);
    const cookieStore = await cookies();
    cookieStore.set(SIGNUP_INTENT_COOKIE, JSON.stringify({ role: parsed.data.role, legal: true }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 15,
      path: "/",
    });
  }

  const next = safeNextPath(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  if (error || !data.url) {
    log.warn("auth.oauth_start_failed", { code: error?.code });
    return go("/login?error=generic");
  }
  // External URL: plain Next redirect (not the locale-aware helper).
  externalRedirect(data.url);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return go("/login?signedOut=1");
}

// Passwords -------------------------------------------------------------------------

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const values = { email: String(raw.email ?? "") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl("/reset-password"),
  });
  if (error && authErrorKey(error) === "rateLimited") {
    return { status: "error", error: "rateLimited", values };
  }
  if (error) log.warn("auth.reset_request_failed", { code: error.code, status: error.status });
  // Same answer whether or not the account exists (no account enumeration).
  return { status: "success", values };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  const session = await getSessionClaims();
  if (!session) return { status: "error", error: "linkInvalid" };

  const { error } = await session.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", error: authErrorKey(error) };

  await session.supabase.auth.signOut();
  return go("/login?passwordUpdated=1");
}

// Two-step verification ---------------------------------------------------------------

export async function verifyMfaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = mfaCodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  const session = await getSessionClaims();
  if (!session) return go("/login");

  const { data: factors } = await session.supabase.auth.mfa.listFactors();
  const factor = (factors?.totp ?? []).find((item) => item.status === "verified");
  if (!factor) return go("/dashboard/settings/security?mfa=required");

  const { error } = await session.supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: parsed.data.code,
  });
  if (error) return { status: "error", error: authErrorKey(error) };
  return go(safeNextPath(parsed.data.next));
}

export type MfaEnrollment =
  | { status: "ready"; factorId: string; qrCode: string; secret: string }
  | { status: "error" };

export async function startMfaEnrollmentAction(): Promise<MfaEnrollment> {
  const session = await getSessionClaims();
  if (!session) return { status: "error" };
  const mfa = session.supabase.auth.mfa;

  // Remove abandoned, unverified factors before starting again.
  const { data: factors } = await mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.status === "unverified") await mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
  if (error || !data) {
    log.warn("auth.mfa_enroll_failed", { code: error?.code });
    return { status: "error" };
  }
  return { status: "ready", factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmMfaEnrollmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = mfaCodeSchema.safeParse(Object.fromEntries(formData));
  const factorId = String(formData.get("factorId") ?? "");
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };
  if (!/^[0-9a-f-]{36}$/i.test(factorId)) return { status: "error", error: "generic" };

  const session = await getSessionClaims();
  if (!session) return go("/login");

  const { error } = await session.supabase.auth.mfa.challengeAndVerify({ factorId, code: parsed.data.code });
  if (error) return { status: "error", error: authErrorKey(error) };
  return { status: "success" };
}

// Legal --------------------------------------------------------------------------------------

export async function acceptTermsAction(formData: FormData): Promise<void> {
  if (formData.get("legal") !== "on") return go("/accept-terms?error=legal");
  const session = await getSessionClaims();
  if (!session) return go("/login");
  const { error } = await session.supabase.rpc("accept_current_legal_documents");
  if (error) {
    log.error("legal.accept_failed", { code: error.code });
    return go("/accept-terms?error=generic");
  }
  return go(safeNextPath(formData.get("next")));
}
