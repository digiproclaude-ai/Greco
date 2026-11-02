import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DeleteButton, PortfolioImages, PortfolioItemForm } from "@/components/expert/portfolio-forms";
import { EditorSection } from "@/components/forms/fields";
import { Link } from "@/i18n/navigation";
import { publicMediaUrl } from "@/lib/media";
import { requireRole } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import {
  deletePortfolioItemAction,
  removePortfolioImageAction,
  savePortfolioItemAction,
  uploadPortfolioImageAction,
} from "@/server/modules/portfolio/actions";
import { MAX_PORTFOLIO_IMAGES, MAX_PORTFOLIO_TERMS } from "@/server/modules/portfolio/schemas";
import { getPortfolioEditor } from "@/server/modules/portfolio/service";
import { industryOptions, termKindLabels, workTerms } from "@/server/modules/taxonomy/labels";
import { getActiveTerms } from "@/server/modules/taxonomy/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expert.portfolio");
  return { title: t("editTitle") };
}

export default function EditPortfolioItemPage({ params }: PageProps<"/[locale]/dashboard/expert/portfolio/[id]">) {
  return (
    <Suspense>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireRole("expert", `/dashboard/expert/portfolio/${id}`);
  const session = await getSessionClaims();
  if (!session || !account.provider || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, locale] = await Promise.all([getTranslations("expert.portfolio"), getLocale()]);
  const [data, terms, kindLabels] = await Promise.all([
    getPortfolioEditor(session.supabase, account.provider.id, id),
    getActiveTerms(locale),
    termKindLabels(),
  ]);
  if (!data || data.item.provenance !== "self_reported") notFound();
  const { item } = data;

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <Link href="/dashboard/expert/portfolio" className="text-sm text-accent hover:underline">
          {t("back")}
        </Link>
        <h1 className="font-display text-3xl font-semibold">{t("editTitle")}</h1>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <PortfolioItemForm
          action={savePortfolioItemAction.bind(null, item.id)}
          values={{
            title: item.title,
            summary: item.summary,
            problem: item.problem,
            solution: item.solution,
            results: item.results,
            role: item.role,
            clientName: item.client_display_name,
            industry: item.industry_term_id,
            projectMonth: item.project_date ? item.project_date.slice(0, 7) : null,
            externalUrl: item.external_url,
            status: item.status,
            termIds: data.termIds,
          }}
          industries={industryOptions(terms)}
          terms={workTerms(terms, data.termIds)}
          kindLabels={kindLabels}
          maxTerms={MAX_PORTFOLIO_TERMS}
          submitLabel={t("editTitle")}
        />
      </div>
      <EditorSection id="images" title={t("fields.images")} description={t("fields.imagesHint")}>
        <PortfolioImages
          images={data.media.map((media) => ({ id: media.id, caption: media.caption, url: publicMediaUrl(media.path) }))}
          uploadAction={uploadPortfolioImageAction.bind(null, item.id)}
          removeAction={removePortfolioImageAction.bind(null, item.id)}
          max={MAX_PORTFOLIO_IMAGES}
        />
      </EditorSection>
      <div>
        <DeleteButton action={deletePortfolioItemAction.bind(null, item.id)} label={t("delete")} confirm={t("deleteConfirm")} />
      </div>
    </div>
  );
}
