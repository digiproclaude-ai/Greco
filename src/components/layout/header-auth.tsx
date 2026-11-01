import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getSessionClaims } from "@/server/auth/session";

/** Auth-aware part of the public header. Reads the session, so it streams in behind Suspense. */
export async function HeaderAuth() {
  const [session, t] = await Promise.all([getSessionClaims(), getTranslations("nav")]);
  if (session) {
    return (
      <Button asChild size="sm">
        <Link href="/dashboard">{t("dashboard")}</Link>
      </Button>
    );
  }
  return <GuestActions login={t("login")} signup={t("signup")} />;
}

export function GuestActions({ login, signup }: { login: string; signup: string }) {
  return (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">{login}</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/register">{signup}</Link>
      </Button>
    </>
  );
}
