import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/alert";

const DOCUMENTS = ["terms", "privacy"] as const;
type LegalDocument = (typeof DOCUMENTS)[number];

function isDocument(value: string): value is LegalDocument {
  return (DOCUMENTS as readonly string[]).includes(value);
}

export function generateStaticParams() {
  return DOCUMENTS.map((document) => ({ document }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/legal/[document]">): Promise<Metadata> {
  const { document } = await params;
  if (!isDocument(document)) return {};
  const t = await getTranslations("metadata");
  return { title: t(document) };
}

export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[document]">) {
  const { document } = await params;
  if (!isDocument(document)) notFound();
  const t = await getTranslations("legal");

  return (
    <article className="mx-auto grid max-w-3xl gap-6 px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl font-semibold">{t(`${document}.title`)}</h1>
      <Alert variant="warning">{t("draftNotice")}</Alert>
      <p className="text-lg text-ink-muted">{t(`${document}.body`)}</p>
    </article>
  );
}
