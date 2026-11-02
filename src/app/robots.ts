import type { MetadataRoute } from "next";

import { getPublicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/api/", "/auth/", "/login", "/register", "/mfa", "/reset-password", "/accept-terms"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
