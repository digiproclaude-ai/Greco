import "server-only";

import type { NextRequest } from "next/server";

import { SIGNUP_INTENT_COOKIE } from "@/server/modules/identity/constants";
import { log } from "@/server/log";

import type { createSupabaseServerClient } from "../db/supabase-server";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Apply what the user chose on the registration page before an OAuth redirect: the starting role
 * and their legal acceptance. Email signups carry these in signup metadata instead.
 */
export async function applySignupIntent(request: NextRequest, supabase: Client) {
  const raw = request.cookies.get(SIGNUP_INTENT_COOKIE)?.value;
  if (!raw) return;
  try {
    const intent = JSON.parse(raw) as { role?: string; legal?: boolean };
    if (intent.legal === true) await supabase.rpc("accept_current_legal_documents");
    if (intent.role === "expert") {
      await supabase.rpc("enable_marketplace_role", { p_role: "expert" });
      await supabase.rpc("switch_active_role", { p_role: "expert" });
    }
  } catch (error) {
    log.warn("auth.signup_intent_invalid", { error });
  }
}
