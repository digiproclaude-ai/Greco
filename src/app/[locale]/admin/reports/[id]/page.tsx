import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ContentStatusForm } from "@/components/admin/admin-forms";
import { ModerateForm, ResolveReportForm } from "@/components/admin/report-forms";
import { EditorSection } from "@/components/forms/fields";
import { Prose } from "@/components/marketplace/prose";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireStaff } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { setContentStatusAction } from "@/server/modules/admin/actions";
import { moderateMessageAction, resolveReportAction, setProjectStatusAction } from "@/server/modules/admin/report-actions";
import { getReportDetail } from "@/server/modules/admin/reports";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reports");
  return { title: t("title") };
}

export default function ReportPage({ params }: PageProps<"/[locale]/admin/reports/[id]">) {
  return (
    <Suspense>
      <Report params={params} />
    </Suspense>
  );
}

async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff(["super_admin", "admin", "moderator", "support"], `/admin/reports/${id}`);
  const session = await getSessionClaims();
  if (!session || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, tInbox, format] = await Promise.all([getTranslations("admin.reports"), getTranslations("inbox.report"), getFormatter()]);
  const detail = await getReportDetail(session.supabase, id);
  if (!detail) notFound();
  const { report } = detail;
  const time = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });
  const open = report.status === "open";

  return (
    <div className="grid max-w-4xl gap-6">
      <div className="grid gap-2">
        <Link href="/admin/reports" className="text-sm text-accent hover:underline">
          {t("back")}
        </Link>
        <h1 className="font-display text-3xl font-semibold">
          {`${t(`targets.${report.target_type as "message"}`)} · ${tInbox(`reasons.${report.reason}`)}`}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <Badge variant={report.source === "system" ? "accent" : "neutral"}>{t(`source.${report.source as "user"}`)}</Badge>
          <Badge variant={open ? "warning" : "success"}>{t(`tabs.${report.status as "open"}`)}</Badge>
          <span>{t("reported", { date: time(report.created_at) })}</span>
        </div>
        {report.handled_at ? (
          <p className="text-sm text-ink-muted">{t("handled", { date: time(report.handled_at), note: report.resolution_note ?? "—" })}</p>
        ) : null}
      </div>

      {report.details ? (
        <EditorSection id="details" title={t("details")}>
          <Prose text={report.details} />
        </EditorSection>
      ) : null}
      {report.signals.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{t("signals")}</span>
          {report.signals.map((signal) => (
            <Badge key={signal} variant="warning">
              {signal}
            </Badge>
          ))}
        </div>
      ) : null}

      {detail.kind === "message" ? (
        <EditorSection id="conversation" title={t("conversation")} description={t("conversationNote")}>
          {detail.thread.length === 0 ? (
            <Alert variant="warning">{t("targetMissing")}</Alert>
          ) : (
            <ol className="grid gap-2">
              {detail.thread.map((m) => (
                <li
                  key={m.message_id}
                  className={cn("grid gap-1 rounded-md border px-4 py-2.5", m.is_reported ? "border-warning bg-warning/5" : "border-line")}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <span className="font-medium text-ink">{m.sender_name ?? "—"}</span>
                    <time dateTime={m.created_at}>{time(m.created_at)}</time>
                    {m.is_reported ? <Badge variant="warning">{t("reportedMessage")}</Badge> : null}
                    {m.moderation_state !== "visible" ? <Badge>{m.moderation_state}</Badge> : null}
                  </div>
                  <p className="break-words whitespace-pre-line">
                    {m.moderation_state === "removed" ? t("removedBody", { body: m.body ?? "" }) : (m.body ?? "")}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {detail.reported ? (
            <ModerateForm
              action={moderateMessageAction.bind(null, report.id, detail.reported.message_id)}
              kind="message"
              removed={detail.reported.moderation_state === "removed"}
            />
          ) : null}
        </EditorSection>
      ) : null}

      {detail.kind === "project" ? (
        <EditorSection id="project" title={detail.project?.title ?? t("targetMissing")}>
          {detail.project ? (
            <>
              <Badge>{detail.project.status}</Badge>
              <Prose text={detail.project.description} />
              <ModerateForm
                action={setProjectStatusAction.bind(null, report.id, detail.project.id)}
                kind="project"
                removed={detail.project.status === "removed"}
              />
            </>
          ) : null}
        </EditorSection>
      ) : null}

      {detail.kind === "provider" ? (
        <EditorSection id="provider" title={detail.provider?.display_name ?? t("targetMissing")}>
          {detail.provider ? (
            <>
              <p className="text-sm text-ink-muted">{detail.provider.headline}</p>
              <div className="flex flex-wrap gap-2">
                <Badge>{detail.provider.status}</Badge>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/experts/${detail.provider.handle}`}>{t("openPublic")}</Link>
                </Button>
              </div>
              {detail.provider.status === "active" || detail.provider.status === "suspended" ? (
                <ContentStatusForm
                  action={setContentStatusAction}
                  targetType="provider"
                  targetId={detail.provider.id}
                  suspended={detail.provider.status === "suspended"}
                />
              ) : null}
            </>
          ) : null}
        </EditorSection>
      ) : null}

      {detail.kind === "listing" ? (
        <EditorSection id="listing" title={detail.listing?.title ?? t("targetMissing")}>
          {detail.listing ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge>{detail.listing.status}</Badge>
                {detail.listing.providers?.handle ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/experts/${detail.listing.providers.handle}/${detail.listing.slug}`}>{t("openPublic")}</Link>
                  </Button>
                ) : null}
              </div>
              {detail.listing.status === "published" || detail.listing.status === "suspended" ? (
                <ContentStatusForm
                  action={setContentStatusAction}
                  targetType="listing"
                  targetId={detail.listing.id}
                  suspended={detail.listing.status === "suspended"}
                />
              ) : null}
            </>
          ) : null}
        </EditorSection>
      ) : null}

      {detail.kind === "user" ? (
        <EditorSection id="user" title={detail.profile?.display_name ?? detail.profile?.full_name ?? t("targetMissing")}>
          {detail.profile ? <p className="text-sm">{t("accountStatus", { status: detail.profile.account_status })}</p> : null}
        </EditorSection>
      ) : null}

      {detail.kind === "proposal" ? (
        <EditorSection id="proposal" title={detail.proposal?.projects?.title ?? t("targetMissing")}>
          {detail.proposal ? (
            <>
              <p className="text-sm text-ink-muted">{detail.proposal.providers?.display_name}</p>
              <Prose text={detail.proposal.proposed_solution} />
            </>
          ) : null}
        </EditorSection>
      ) : null}

      {open ? (
        <EditorSection id="resolve" title={t("resolve.title")}>
          <ResolveReportForm action={resolveReportAction.bind(null, report.id)} />
        </EditorSection>
      ) : null}
    </div>
  );
}
