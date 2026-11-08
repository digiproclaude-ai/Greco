import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Avatar } from "@/components/marketplace/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { CONTACT_HIDDEN_TOKEN } from "@/server/modules/messaging/schemas";
import { listConversations, type ConversationSummary } from "@/server/modules/messaging/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inbox");
  return { title: t("title") };
}

export default function MessagesPage({ searchParams }: PageProps<"/[locale]/dashboard/messages">) {
  return (
    <Suspense>
      <Inbox searchParams={searchParams} />
    </Suspense>
  );
}

async function Inbox({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const account = await requireUser("/dashboard/messages");
  const session = await getSessionClaims();
  if (!session) return null;
  const archived = params.view === "archived";
  const [t, format, hiddenLabel] = await Promise.all([
    getTranslations("inbox"),
    getFormatter(),
    getTranslations("inbox.thread").then((tt) => tt("hidden")),
  ]);
  const conversations = await listConversations(session.supabase, archived);
  const now = new Date();

  const preview = (c: ConversationSummary) => {
    if (c.last_moderation_state === "removed") return t("removedPreview");
    const text = c.last_body?.replaceAll(CONTACT_HIDDEN_TOKEN, `[${hiddenLabel}]`).replace(/\s+/g, " ").slice(0, 140);
    if (!text) return c.last_message_at ? t("attachmentOnly") : "";
    return c.last_sender_is_me ? t("you", { text }) : text;
  };

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-ink-muted">{t("intro")}</p>
      </div>
      <nav aria-label={t("title")} className="flex gap-4 border-b border-line text-sm">
        {(["inbox", "archived"] as const).map((tab) => {
          const active = (tab === "archived") === archived;
          return (
            <Link
              key={tab}
              href={tab === "archived" ? "/dashboard/messages?view=archived" : "/dashboard/messages"}
              aria-current={active ? "page" : undefined}
              className={cn("-mb-px border-b-2 px-1 pb-2", active ? "border-accent font-medium text-accent" : "border-transparent text-ink-muted")}
            >
              {t(`tabs.${tab}`)}
            </Link>
          );
        })}
      </nav>
      {conversations.length === 0 ? (
        <div className="grid gap-2 rounded-lg border border-dashed border-line bg-surface p-8 text-center text-ink-muted">
          <p>{archived ? t("emptyArchived") : t("empty")}</p>
          {!archived ? (
            <p className="text-sm">{account.profile.active_role === "expert" ? t("emptyExpertHint") : t("emptyClientHint")}</p>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {conversations.map((c) => {
            const unread = Number(c.unread_count);
            const name = c.counterpart_name ?? "—";
            const when = c.last_message_at ?? c.created_at;
            return (
              <li key={c.id}>
                <Link href={`/dashboard/messages/${c.id}`} className="flex items-start gap-3 px-5 py-4 hover:bg-paper">
                  <Avatar path={c.counterpart_avatar_path} name={name} size={40} />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className={cn("truncate", unread > 0 ? "font-semibold" : "font-medium")}>{name}</span>
                      <span className="text-xs text-ink-muted">{format.relativeTime(new Date(when), now)}</span>
                    </span>
                    {c.context_project_title || c.context_listing_title ? (
                      <span className="truncate text-xs text-ink-muted">
                        {t("about", { title: c.context_project_title ?? c.context_listing_title ?? "" })}
                      </span>
                    ) : null}
                    <span className={cn("truncate text-sm", unread > 0 ? "text-ink" : "text-ink-muted")}>{preview(c)}</span>
                    <span className="flex gap-2">
                      {unread > 0 ? <Badge variant="accent">{t("unread", { count: unread })}</Badge> : null}
                      {c.muted ? <Badge>{t("muted")}</Badge> : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
