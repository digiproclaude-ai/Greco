import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getPublicEnv } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Supabase client acting as the signed-in user (RLS applies). Create one per request.
 * Server Components cannot write cookies; the proxy refreshes sessions before rendering.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  // Session checks read the clock (token expiry), so they must run per request and never be
  // part of a prerendered or prefetched shell.
  await connection();
  const env = getPublicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component: cookies are read-only there. Safe to ignore
            // because the proxy refreshes the session on every request.
          }
        },
      },
    },
  );
}

/** Public pages give up on a slow database instead of hanging (they show empty states). */
const PUBLIC_READ_TIMEOUT_MS = 8000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const timeout = AbortSignal.timeout(PUBLIC_READ_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}

/** Supabase client with no user session, for public reads (RLS applies as `anon`). */
export function createSupabaseAnonClient() {
  const env = getPublicEnv();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookies: { getAll: () => [], setAll: () => {} }, global: { fetch: fetchWithTimeout } },
  );
}
