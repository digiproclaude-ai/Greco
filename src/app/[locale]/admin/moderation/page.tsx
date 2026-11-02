import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { listPendingReviews, listRecentDecisions } from "@/server/modules/admin/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.moderation");
  return { title: t("title") };
}

const FLAG_KEYS = ["prompt_injection", "contact_email", "contact_phone", "contact_messenger"] as const;

export default async function ModerationPage() {
  await requireStaff(["super_admin", "admin", "moderator"], "/admin/moderation");
  const session = await getSessionClaims();
  const [t, format] = await Promise.all([getTranslations("admin.moderation"), getFormatter()]);
  if (!session) return null;
  const [pending, history] = await Promise.all([listPendingReviews(session.supabase), listRecentDecisions(session.supabase)]);
  const flagLabel = (flag: string) => (FLAG_KEYS as readonly string[]).includes(flag) ? t(`flags.${flag as (typeof FLAG_KEYS)[number]}`) : flag;

  return (
    <div className="grid max-w-5xl gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-ink-muted">{t("intro")}</p>
      </div>
      <section aria-labelledby="pending" className="grid gap-3">
        <h2 id="pending" className="font-semibold">
          {`${t("pending")} (${pending.length})`}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface p-6 text-center text-ink-muted">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {pending.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="grid min-w-0 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{t(`targets.${item.targetType as "provider" | "listing"}`)}</Badge>
                    <Badge variant={item.kind === "edit" ? "warning" : "accent"}>{t(`kinds.${item.kind as "initial" | "edit"}`)}</Badge>
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {[item.targetType === "listing" ? t("by", { name: item.providerName }) : null, t("submitted", { date: format.dateTime(new Date(item.submittedAt), { dateStyle: "medium", timeStyle: "short" }) })]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {item.flags.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {item.flags.map((flag) => (
                        <li key={flag}>
                          <Badge variant="warning">{flagLabel(flag)}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <Button asChild size="sm">
                  <Link href={`/admin/moderation/${item.id}`}>{t("open")}</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="history" className="grid gap-3">
        <h2 id="history" className="font-semibold">
          {t("history")}
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("historyEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-[15px]">
            {history.map((row) => (
              <li key={row.id} className="grid gap-1 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={row.action === "approve" || row.action === "reinstate" ? "success" : "warning"}>
                    {t(`actions.${row.action as "approve"}`)}
                  </Badge>
                  <span>{t(`targets.${row.target_type as "provider"}`)}</span>
                  {row.providers ? <span className="text-ink-muted">{`· ${row.providers.display_name}`}</span> : null}
                  <span className="text-sm text-ink-muted">{`· ${format.dateTime(new Date(row.created_at), { dateStyle: "medium", timeStyle: "short" })}`}</span>
                </div>
                {row.reason ? <p className="text-sm whitespace-pre-line text-ink-muted">{row.reason}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
