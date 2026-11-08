import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ConfirmButton } from "@/components/projects/project-forms";
import { budgetText, dateFormatter, StatusBadge } from "@/components/projects/summary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { declineInvitationAction } from "@/server/modules/projects/proposal-actions";
import { listInvitations, listOpenProjects } from "@/server/modules/projects/service";
import { categoryOptions, getCategories } from "@/server/modules/taxonomy/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects.board");
  return { title: t("title") };
}

export default function ProjectBoardPage({ searchParams }: PageProps<"/[locale]/dashboard/expert/projects">) {
  return (
    <Suspense>
      <Board searchParams={searchParams} />
    </Suspense>
  );
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || null;

async function Board({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const account = await requireRole("expert", "/dashboard/expert/projects");
  const session = await getSessionClaims();
  if (!session || !account.provider) return null;
  const [t, locale, date] = await Promise.all([getTranslations("projects"), getLocale(), dateFormatter()]);
  const q = first(params.q)?.slice(0, 100) ?? null;
  const categoryParam = first(params.category);
  const categoryId = categoryParam && /^[0-9a-f-]{36}$/i.test(categoryParam) ? categoryParam : null;

  const [projects, invitations, categories] = await Promise.all([
    listOpenProjects(session.supabase, { categoryId, q }),
    listInvitations(session.supabase, account.provider.id),
    getCategories(locale),
  ]);
  const options = categoryOptions(categories);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const pending = invitations.filter((i) => i.status === "sent" && i.projects?.status === "open");

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-semibold">{t("board.title")}</h1>
        <p className="text-ink-muted">{t("board.intro")}</p>
      </div>
      {account.provider.status !== "active" ? <Alert variant="warning">{t("board.notActive")}</Alert> : null}

      <section aria-labelledby="invitations" className="grid gap-3">
        <h2 id="invitations" className="font-semibold">
          {t("board.invitations")}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("board.invitationsEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {pending.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="grid min-w-0 gap-1">
                  <Link href={`/dashboard/expert/projects/${invitation.projects?.id}`} className="font-medium hover:text-accent">
                    {invitation.projects?.title}
                  </Link>
                  <span className="text-sm text-ink-muted">{t("board.invitedOn", { date: date(invitation.created_at) })}</span>
                </div>
                <ConfirmButton action={declineInvitationAction.bind(null, invitation.id)} label={t("board.decline")} variant="ghost" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <form role="search" className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="board-q">{t("board.search")}</Label>
          <Input id="board-q" name="q" type="search" defaultValue={q ?? ""} maxLength={100} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="board-category">{t("board.category")}</Label>
          <NativeSelect id="board-category" name="category" defaultValue={categoryId ?? ""}>
            <option value="">{t("board.allCategories")}</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">
          {t("board.filter")}
        </Button>
      </form>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-ink-muted">{t("board.empty")}</p>
      ) : (
        <ul className="grid gap-3">
          {projects.map((project) => (
            <li key={project.id} className="grid gap-2 rounded-lg border border-line bg-surface p-5">
              <Link href={`/dashboard/expert/projects/${project.id}`} className="font-semibold hover:text-accent">
                {project.title}
              </Link>
              {project.description ? <p className="line-clamp-3 text-sm text-ink-muted">{project.description}</p> : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                <StatusBadge status="open" label={budgetText(t, project, locale)} />
                <span>{t(`timelineKinds.${project.timeline_kind}`)}</span>
                {project.category_id && categoryName.get(project.category_id) ? <span>{categoryName.get(project.category_id)}</span> : null}
                <span>{t("board.proposals", { count: project.proposals_count })}</span>
                <span>{t("board.posted", { date: date(project.published_at) })}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
