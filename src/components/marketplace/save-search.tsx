import { BellPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getSessionClaims } from "@/server/auth/session";
import { saveSearchAction } from "@/server/modules/saved/search-actions";

import { SaveSearchForm } from "./save-search-form";

/** "Save this search" for signed-in users; a sign-in link otherwise. Render inside Suspense. */
export async function SaveSearch({
  kind,
  query,
  defaultName,
  returnTo,
}: {
  kind: "services" | "experts";
  query: Record<string, string>;
  defaultName: string;
  returnTo: string;
}) {
  const [session, t] = await Promise.all([getSessionClaims(), getTranslations("marketplace.save")]);
  if (!session) {
    return (
      <Button asChild variant="secondary" size="sm">
        <Link href={`/login?next=${encodeURIComponent(returnTo)}`}>
          <BellPlus aria-hidden="true" />
          {t("saveSearch")}
        </Link>
      </Button>
    );
  }
  return <SaveSearchForm action={saveSearchAction.bind(null, kind, query)} defaultName={defaultName} />;
}
