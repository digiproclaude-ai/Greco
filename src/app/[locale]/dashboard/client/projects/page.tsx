import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { dateFormatter, StatusBadge } from "@/components/projects/summary";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { listClientProjects } from "@/server/modules/projects/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects.client");
  return { title: t("title") };
}

export default async function ClientProjectsPage() {
  const account = await requireRole("client", "/dashboard/client/projects");
  const session = await getSessionClaims();
  const [t, date] = await Promise.all([getTranslations("projects"), dateFormatter()]);
  if (!session) return null;
  const projects = await listClientProjects(session.supabase, account.userId);

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-display text-3xl font-semibold">{t("client.title")}</h1>
          <p className="text-ink-muted">{t("client.intro")}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/client/projects/new">{t("client.new")}</Link>
        </Button>
      </div>
      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-ink-muted">{t("client.empty")}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {projects.map((project) => (
            <li key={project.id} className="grid gap-1 px-5 py-4">
              <Link href={`/dashboard/client/projects/${project.id}`} className="font-medium hover:text-accent">
                {project.title}
              </Link>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                <StatusBadge status={project.status} label={t(`statuses.${project.status}`)} />
                {project.status !== "draft" ? <span>{t("client.proposals", { count: project.proposals_count })}</span> : null}
                {project.status === "open" && project.expires_at ? (
                  <span>{t("client.expires", { date: date(project.expires_at) })}</span>
                ) : (
                  <span>{t("client.created", { date: date(project.created_at) })}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
