import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Avatar } from "@/components/marketplace/avatar";
import { Composer } from "@/components/messages/composer";
import { ConversationLive } from "@/components/messages/conversation-live";
import { MessageBody } from "@/components/messages/message-body";
import { ReportForm } from "@/components/messages/report-form";
import { ConfirmButton } from "@/components/projects/project-forms";
import { AttachmentList } from "@/components/projects/summary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { MAX_ATTACHMENT_MB } from "@/server/modules/attachments/service";
import {
  blockAction,
  markConversationReadAction,
  reportAction,
  sendMessageAction,
  updateConversationAction,
} from "@/server/modules/messaging/actions";
import { MAX_MESSAGE_FILES } from "@/server/modules/messaging/schemas";
import { getConversation } from "@/server/modules/messaging/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inbox");
  return { title: t("title") };
}

export default function ConversationPage({ params }: PageProps<"/[locale]/dashboard/messages/[id]">) {
  return (
    <Suspense>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireUser(`/dashboard/messages/${id}`);
  const session = await getSessionClaims();
  if (!session || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, format] = await Promise.all([getTranslations("inbox"), getFormatter()]);
  const data = await getConversation(session.supabase, account.userId, id);
  if (!data) notFound();
  const { summary, messages } = data;
  const name = summary.counterpart_name ?? "—";
  const bind = <A extends unknown[], R>(fn: (conversationId: string, ...rest: A) => R) => fn.bind(null, id) as (...rest: A) => R;
  const time = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });
  const hasMasked = messages.some((m) => m.state === "masked");
  const contextHref =
    summary.context_project_id && summary.my_role === "client"
      ? `/dashboard/client/projects/${summary.context_project_id}`
      : summary.context_project_id
        ? `/dashboard/expert/projects/${summary.context_project_id}`
        : null;

  return (
    <div className="grid max-w-3xl gap-4">
      <Link href="/dashboard/messages" className="text-sm text-accent hover:underline">
        {t("back")}
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar path={summary.counterpart_avatar_path} name={name} size={48} />
          <div className="grid min-w-0 gap-0.5">
            <h1 className="truncate font-display text-2xl font-semibold">{name}</h1>
            {summary.context_project_title || summary.context_listing_title ? (
              <p className="truncate text-sm text-ink-muted">
                {contextHref ? (
                  <Link href={contextHref} className="hover:text-accent">
                    {t("about", { title: summary.context_project_title ?? "" })}
                  </Link>
                ) : (
                  t("about", { title: summary.context_listing_title ?? summary.context_project_title ?? "" })
                )}
              </p>
            ) : null}
          </div>
        </div>
        {summary.counterpart_handle ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/experts/${summary.counterpart_handle}`}>{t("viewProfile")}</Link>
          </Button>
        ) : null}
      </header>

      <details className="rounded-md border border-line bg-surface px-4 py-2 text-sm">
        <summary className="cursor-pointer font-medium">{t("actions.title")}</summary>
        <div className="flex flex-wrap items-start gap-2 py-3">
          <ConfirmButton
            action={bind(updateConversationAction)}
            name="action"
            value={summary.muted ? "unmute" : "mute"}
            label={summary.muted ? t("actions.unmute") : t("actions.mute")}
            variant="ghost"
          />
          <ConfirmButton
            action={bind(updateConversationAction)}
            name="action"
            value={summary.archived ? "unarchive" : "archive"}
            label={summary.archived ? t("actions.unarchive") : t("actions.archive")}
            variant="ghost"
          />
          {summary.counterpart_user_id ? (
            <ConfirmButton
              action={bind(blockAction)}
              name="action"
              value={summary.blocked_by_me ? "unblock" : "block"}
              label={summary.blocked_by_me ? t("actions.unblock") : t("actions.block")}
              confirm={summary.blocked_by_me ? undefined : t("actions.blockConfirm")}
              variant="ghost"
            />
          ) : null}
          {summary.counterpart_user_id ? (
            <ReportForm action={reportAction.bind(null, "user", summary.counterpart_user_id)} label={t("actions.report")} idPrefix="report-user" />
          ) : null}
        </div>
      </details>

      <section aria-label={t("thread.label", { name })} className="overflow-hidden rounded-lg border border-line bg-paper">
        <ol className="grid max-h-[60vh] gap-3 overflow-y-auto p-4" aria-live="polite" aria-relevant="additions">
          <li className="text-center text-xs text-ink-muted">{t("thread.start", { name })}</li>
          {messages.map((m) => (
            <li key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "grid max-w-[85%] gap-2 rounded-lg px-4 py-2.5",
                  m.mine ? "bg-accent-tint" : "border border-line bg-surface",
                  m.state === "removed" && "italic text-ink-muted",
                )}
              >
                {m.state === "removed" ? (
                  <p>{t("thread.removed")}</p>
                ) : m.body ? (
                  <MessageBody text={m.body} hiddenLabel={t("thread.hidden")} />
                ) : null}
                {m.state !== "removed" && m.attachments.length > 0 ? <AttachmentList files={m.attachments} /> : null}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                  <time dateTime={m.createdAt}>{time(m.createdAt)}</time>
                  {!m.mine && m.state !== "removed" ? (
                    <ReportForm action={reportAction.bind(null, "message", m.id)} label={t("thread.report")} idPrefix={`report-${m.id}`} />
                  ) : null}
                </div>
              </div>
            </li>
          ))}
          <li id="thread-end" aria-hidden="true" />
        </ol>
        {hasMasked ? <p className="border-t border-line px-4 py-2 text-xs text-ink-muted">{t("thread.maskedNote")}</p> : null}
        {summary.can_reply ? (
          <Composer action={bind(sendMessageAction)} maxFiles={MAX_MESSAGE_FILES} maxMb={MAX_ATTACHMENT_MB} />
        ) : (
          <div className="border-t border-line bg-surface p-4">
            <Alert variant="warning">{summary.blocked_by_me ? t("composer.blockedByYou") : t("composer.cannotReply")}</Alert>
          </div>
        )}
      </section>

      <ConversationLive
        conversationId={id}
        markRead={bind(markConversationReadAction)}
        lastMessageId={messages.at(-1)?.id ?? null}
      />
    </div>
  );
}
