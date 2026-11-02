import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MergeForm, TermForm } from "@/components/admin/admin-forms";
import { EditorSection } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { mergeTermAction, saveTermAction } from "@/server/modules/admin/actions";
import { listTerms } from "@/server/modules/admin/service";

const KINDS = ["skill", "technology", "tool", "framework", "model", "platform", "industry", "use_case"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.taxonomy");
  return { title: t("editTitle") };
}

export default function EditTermPage({ params }: PageProps<"/[locale]/admin/taxonomy/[id]">) {
  return (
    <Suspense>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff(["super_admin", "admin", "moderator"], `/admin/taxonomy/${id}`);
  const session = await getSessionClaims();
  const [t, tKinds, locale] = await Promise.all([getTranslations("admin.taxonomy"), getTranslations("expert.termKinds"), getLocale()]);
  if (!session) return null;
  const terms = await listTerms(session.supabase, locale, {});
  const term = terms.find((x) => x.id === id);
  if (!term || term.status === "merged") notFound();
  const targets = terms
    .filter((x) => x.status === "active" && x.id !== term.id)
    .map((x) => ({ value: x.id, label: `${x.name} (${tKinds(x.kind)})` }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <Link href="/admin/taxonomy" className="text-sm text-accent hover:underline">
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold">{term.name}</h1>
          <Badge>{t(`statuses.${term.status as "active"}`)}</Badge>
        </div>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <TermForm
          action={saveTermAction.bind(null, term.id)}
          kinds={KINDS.map((k) => ({ value: k, label: tKinds(k) }))}
          values={{ kind: term.kind, slug: term.slug, name: term.name, description: term.description, aliases: term.aliases }}
        />
      </div>
      <EditorSection id="merge" title={t("merge")} description={t("mergeHint")}>
        <MergeForm action={mergeTermAction} fromId={term.id} targets={targets} />
      </EditorSection>
    </div>
  );
}
