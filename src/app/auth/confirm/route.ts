import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { log } from "@/server/log";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Email confirmation with a token hash. Unlike the PKCE callback, this also works when the
 * link is opened on a different device. Requires the Supabase email templates described in
 * ENVIRONMENT_SETUP.md.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"), type === "recovery" ? "/reset-password" : "/dashboard");

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    log.warn("auth.confirm_failed", { code: error.code, status: error.status });
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}
