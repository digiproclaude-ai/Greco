"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/server/db/database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Browser Supabase client with the publishable key and the user's session cookie. Used only for
 * Realtime subscriptions: reads and writes go through Server Components and Server Actions.
 */
export function getBrowserSupabase() {
  const env = getPublicEnv();
  client ??= createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return client;
}
