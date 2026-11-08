import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireStaff } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { listReports, REPORT_STATUSES } from "@/server/modules/admin/reports";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reports");
  return { title: t("title") };
}

export default function ReportsPage({ searchParams }: PageProps<"/[locale]/admin/reports">) {
  return (
    <Suspense>
      <Reports searchParams={searchParams} />
    </Suspense>
  );
}

async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  await requireStaff(["super_admin", "admin", "moderator", "support"], "/admin/reports");
  const session = await getSessionClaims();
  if (!session) return null;
  const status = REPORT_STATUSES.find((s) => s === params.status) ?? "open";
  const [t, tInbox, format] = await Promise.all([getTranslations("admin.reports"), getTranslations("inbox.report"), getFormatter()]);
  const reports = await listReports(session.supabase, status);

  return (
    <div className="grid max-w-5xl gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-ink-muted">{t("intro")}</p>
      </div>
      <nav aria-label={t("title")} className="flex gap-4 border-b border-line text-sm">
        {REPORT_STATUSES.map((tab) => (
          <Link
            key={tab}
            href={tab === "open" ? "/admin/reports" : `/admin/reports?status=${tab}`}
            aria-current={tab === status ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-1 pb-2", tab === status ? "border-accent font-medium text-accent" : "border-transparent text-ink-muted")}
          >
            {t(`tabs.${tab}`)}
          </Link>
        ))}
      </nav>
      {reports.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-6 text-center text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {reports.map((report) => (
            <li key={report.id} className="grid gap-1 px-5 py-4">
              <Link href={`/admin/reports/${report.id}`} className="font-medium hover:text-accent">
                {`${t(`targets.${report.target_type as "message"}`)} · ${tInbox(`reasons.${report.reason}`)}`}
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <Badge variant={report.source === "system" ? "accent" : "neutral"}>{t(`source.${report.source as "user"}`)}</Badge>
                {report.signals.map((signal) => (
                  <Badge key={signal} variant="warning">
                    {signal}
                  </Badge>
                ))}
                <span>{t("reported", { date: format.dateTime(new Date(report.created_at), { dateStyle: "medium", timeStyle: "short" }) })}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
