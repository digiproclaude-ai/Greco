import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { splitLocale } from "./lib/locale-path";

const handleI18n = createIntlMiddleware(routing);

/** Pages that need a session. The pages re-check on the server; this only redirects early. */
const PROTECTED = [/^\/dashboard(\/|$)/, /^\/admin(\/|$)/, /^\/accept-terms(\/|$)/, /^\/mfa(\/|$)/, /^\/reset-password(\/|$)/];

type PendingCookie = { name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] };

export async function proxy(request: NextRequest) {
  // Reuse an upstream request ID only if it looks like one; never echo arbitrary input.
  const incomingId = request.headers.get("x-request-id");
  const requestId = incomingId && /^[A-Za-z0-9-]{8,64}$/.test(incomingId) ? incomingId : crypto.randomUUID();
  request.headers.set("x-request-id", requestId);

  const pendingCookies: PendingCookie[] = [];
  let cacheHeaders: Record<string, string> = {};
  let signedIn = false;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value); // visible to Server Components in this request
            pendingCookies.push({ name, value, options });
          }
          cacheHeaders = { ...cacheHeaders, ...headers };
        },
      },
    });
    // Verifies the JWT and refreshes an expiring session (writing new cookies via setAll).
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  }

  const { locale, path } = splitLocale(request.nextUrl.pathname, routing.locales);
  let response: NextResponse;

  if (!signedIn && PROTECTED.some((pattern) => pattern.test(path))) {
    const url = request.nextUrl.clone();
    url.pathname = locale && locale !== routing.defaultLocale ? `/${locale}/login` : "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    response = NextResponse.redirect(url);
  } else {
    response = handleI18n(request);
  }

  for (const { name, value, options } of pendingCookies) response.cookies.set(name, value, options);
  for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  // Skip API routes, auth route handlers, Next internals and files with an extension.
  matcher: ["/((?!api|auth/|_next|_vercel|.*\\..*).*)"],
};
