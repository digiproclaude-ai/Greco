import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TermForm } from "@/components/admin/admin-forms";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/server/auth/guards";
import { saveTermAction } from "@/server/modules/admin/actions";

const KINDS = ["skill", "technology", "tool", "framework", "model", "platform", "industry", "use_case"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.taxonomy");
  return { title: t("newTitle") };
}

export default async function NewTermPage() {
  await requireStaff(["super_admin", "admin", "moderator"], "/admin/taxonomy/new");
  const [t, tKinds] = await Promise.all([getTranslations("admin.taxonomy"), getTranslations("expert.termKinds")]);
  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <Link href="/admin/taxonomy" className="text-sm text-accent hover:underline">
          {t("back")}
        </Link>
        <h1 className="font-display text-3xl font-semibold">{t("newTitle")}</h1>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <TermForm
          action={saveTermAction.bind(null, null)}
          kinds={KINDS.map((k) => ({ value: k, label: tKinds(k) }))}
          values={{ kind: "skill", slug: "", name: "", description: null, aliases: [] }}
        />
      </div>
    </div>
  );
}
