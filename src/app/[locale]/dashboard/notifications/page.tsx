import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { ConfirmButton } from "@/components/projects/project-forms";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { markAllNotificationsReadAction, openNotificationAction } from "@/server/modules/notifications/actions";
import { notificationText } from "@/server/modules/notifications/present";
import { listNotifications } from "@/server/modules/notifications/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

export default async function NotificationsPage() {
  const account = await requireUser("/dashboard/notifications");
  const session = await getSessionClaims();
  if (!session) return null;
  const [t, format] = await Promise.all([getTranslations("notifications"), getFormatter()]);
  const notifications = await listNotifications(session.supabase, account.userId);
  const now = new Date();
  const unread = notifications.some((n) => !n.read_at);

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
          <p className="text-ink-muted">{t("intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unread ? <ConfirmButton action={markAllNotificationsReadAction} label={t("markAll")} variant="ghost" /> : null}
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/settings/notifications">{t("settings")}</Link>
          </Button>
        </div>
      </div>
      {notifications.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {notifications.map((n) => {
            const { title, reason } = notificationText(t, n);
            return (
              <li key={n.id}>
                <form action={openNotificationAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button type="submit" className="flex w-full items-start gap-3 px-5 py-4 text-start hover:bg-paper">
                    <span
                      aria-hidden="true"
                      className={cn("mt-2 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-accent")}
                    />
                    <span className="grid min-w-0 gap-0.5">
                      <span className={cn(n.read_at ? "text-ink-muted" : "font-medium")}>
                        {!n.read_at ? <span className="sr-only">{`${t("unread")}: `}</span> : null}
                        {title}
                      </span>
                      {reason ? <span className="text-sm whitespace-pre-line text-ink-muted">{reason}</span> : null}
                      <span className="text-xs text-ink-muted">{format.relativeTime(new Date(n.created_at), now)}</span>
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
