import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/safe-redirect";
import { applySignupIntent } from "@/server/auth/post-auth";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { SIGNUP_INTENT_COOKIE } from "@/server/modules/identity/constants";
import { log } from "@/server/log";

/** OAuth and email-link callback: exchange the one-time code for a session (PKCE). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await applySignupIntent(request, supabase);
      const response = NextResponse.redirect(new URL(next, origin));
      response.cookies.delete(SIGNUP_INTENT_COOKIE);
      return response;
    }
    log.warn("auth.callback_failed", { code: error.code, status: error.status });
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}
