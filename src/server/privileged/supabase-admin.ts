import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/server/db/database.types";
import { getServerEnv } from "@/server/env";

/**
 * Supabase client with the secret (service-role) key: bypasses RLS.
 * Only for webhooks, jobs and audited admin operations (SECURITY.md §4).
 */
export function createSupabaseAdminClient() {
  const secretKey = getServerEnv().SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not configured");
  }
  return createClient<Database>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
