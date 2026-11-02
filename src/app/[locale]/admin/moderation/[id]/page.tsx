import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DecisionForm } from "@/components/admin/admin-forms";
import { ListingReview, ProfileReview } from "@/components/admin/review-content";
import { EditorSection } from "@/components/forms/fields";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { decideReviewAction } from "@/server/modules/admin/actions";
import { getReviewDetail } from "@/server/modules/admin/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.moderation.detail");
  return { title: t("title") };
}

const FLAG_KEYS = ["prompt_injection", "contact_email", "contact_phone", "contact_messenger"] as const;

export default function ReviewPage({ params }: PageProps<"/[locale]/admin/moderation/[id]">) {
  return (
    <Suspense>
      <Review params={params} />
    </Suspense>
  );
}

async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff(["super_admin", "admin", "moderator"], `/admin/moderation/${id}`);
  const session = await getSessionClaims();
  if (!session || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, tStatus, format, locale] = await Promise.all([
    getTranslations("admin.moderation"),
    getTranslations("expert.services.statuses"),
    getFormatter(),
    getLocale(),
  ]);
  const detail = await getReviewDetail(session.supabase, id, locale);
  if (!detail) notFound();
  const { request, provider } = detail;
  const isListing = request.target_type === "listing";
  const title = isListing ? (detail.listing?.title ?? "") : provider.display_name;
  const publicHref = isListing && detail.listing ? `/experts/${provider.handle}/${detail.listing.slug}` : `/experts/${provider.handle}`;
  const currentStatus = isListing ? detail.listing?.status : provider.status;

  return (
    <div className="grid max-w-4xl gap-6">
      <div className="grid gap-2">
        <Link href="/admin/moderation" className="text-sm text-accent hover:underline">
          {t("detail.back")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t(`targets.${request.target_type as "provider" | "listing"}`)}</Badge>
          <Badge variant={request.kind === "edit" ? "warning" : "accent"}>{t(`kinds.${request.kind as "initial" | "edit"}`)}</Badge>
        </div>
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="text-sm text-ink-muted">
          {[
            isListing ? t("by", { name: provider.display_name }) : null,
            t("submitted", { date: format.dateTime(new Date(request.submitted_at), { dateStyle: "medium", timeStyle: "short" }) }),
            currentStatus
              ? t("detail.status", {
                  status: isListing ? tStatus(currentStatus as "draft") : currentStatus,
                })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <Link href={publicHref} className="text-sm text-accent hover:underline">
          {t("detail.openPublic")}
        </Link>
      </div>

      <EditorSection id="flags" title={t("flags.title")}>
        {request.flags.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("flags.none")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {request.flags.map((flag) => (
              <li key={flag}>
                <Badge variant="warning">
                  {(FLAG_KEYS as readonly string[]).includes(flag) ? t(`flags.${flag as (typeof FLAG_KEYS)[number]}`) : flag}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </EditorSection>

      <EditorSection id="content" title={t("detail.content")}>
        {detail.profile ? <ProfileReview page={detail.profile} /> : null}
        {detail.listing ? <ListingReview page={detail.listing} /> : null}
      </EditorSection>

      <EditorSection id="decision" title={t("detail.decision")}>
        {request.status !== "pending" ? (
          <Alert>{t("detail.notPending")}</Alert>
        ) : (
          <>
            {request.kind === "edit" ? <Alert variant="warning">{t("detail.editNote")}</Alert> : null}
            <DecisionForm action={decideReviewAction.bind(null, request.id)} isEdit={request.kind === "edit"} />
          </>
        )}
      </EditorSection>

      {detail.history.length > 0 ? (
        <EditorSection id="history" title={t("detail.historyTitle")}>
          <ul className="grid gap-3 text-[15px]">
            {detail.history.map((row) => (
              <li key={row.id} className="grid gap-0.5">
                <span className="font-medium">
                  {`${t(`actions.${row.action as "approve"}`)} · ${format.dateTime(new Date(row.created_at), { dateStyle: "medium", timeStyle: "short" })}`}
                </span>
                {row.reason ? <span className="text-sm whitespace-pre-line text-ink-muted">{row.reason}</span> : null}
              </li>
            ))}
          </ul>
        </EditorSection>
      ) : null}
    </div>
  );
}
