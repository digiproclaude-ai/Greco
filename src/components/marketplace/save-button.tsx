import { Bookmark, BookmarkCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getSessionClaims } from "@/server/auth/session";
import { toggleSavedAction } from "@/server/modules/saved/actions";
import { isSaved } from "@/server/modules/saved/service";

/** Save / unsave toggle. Reads the session, so render it inside Suspense on public pages. */
export async function SaveButton({ kind, id, returnTo }: { kind: "provider" | "listing" | "category"; id: string; returnTo: string }) {
  const [session, t] = await Promise.all([getSessionClaims(), getTranslations("marketplace.save")]);
  if (!session) {
    return (
      <Button asChild variant="secondary" size="sm">
        <Link href={`/login?next=${encodeURIComponent(returnTo)}`}>
          <Bookmark aria-hidden="true" />
          {t("save")}
        </Link>
      </Button>
    );
  }
  const saved = await isSaved(session.supabase, session.userId, kind, id);
  return (
    <form action={toggleSavedAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="saved" value={saved ? "1" : "0"} />
      <Button type="submit" variant="secondary" size="sm" aria-pressed={saved}>
        {saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
        {saved ? t("saved") : t("save")}
      </Button>
    </form>
  );
}
