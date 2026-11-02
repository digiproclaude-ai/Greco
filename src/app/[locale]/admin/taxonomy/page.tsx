import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { InlineAction } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { setTermStatusAction } from "@/server/modules/admin/actions";
import { listTerms, type AdminTerm } from "@/server/modules/admin/service";
import type { TermKind } from "@/server/modules/taxonomy/service";

const KINDS = ["skill", "technology", "tool", "framework", "model", "platform", "industry", "use_case"] as const;
const STATUSES = ["active", "pending", "retired", "merged"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.taxonomy");
  return { title: t("title") };
}

export default function AdminTaxonomyPage({ searchParams }: PageProps<"/[locale]/admin/taxonomy">) {
  return (
    <Suspense>
      <Taxonomy searchParams={searchParams} />
    </Suspense>
  );
}

async function Taxonomy({ searchParams }: { searchParams: PageProps<"/[locale]/admin/taxonomy">["searchParams"] }) {
  await requireStaff(["super_admin", "admin", "moderator"], "/admin/taxonomy");
  const session = await getSessionClaims();
  const raw = await searchParams;
  const kind = (KINDS as readonly string[]).includes(String(raw.kind)) ? (raw.kind as TermKind) : null;
  const status = (STATUSES as readonly string[]).includes(String(raw.status)) ? String(raw.status) : null;
  const [t, tKinds, locale] = await Promise.all([getTranslations("admin.taxonomy"), getTranslations("expert.termKinds"), getLocale()]);
  if (!session) return null;
  const [terms, suggestions] = await Promise.all([
    listTerms(session.supabase, locale, { kind, status }),
    listTerms(session.supabase, locale, { status: "pending" }),
  ]);

  const actions = (term: AdminTerm) => (
    <div className="flex flex-wrap gap-2">
      {term.status === "pending" ? (
        <InlineAction action={setTermStatusAction} fields={{ id: term.id, status: "active" }} label={t("approve")} />
      ) : null}
      {term.status === "active" || term.status === "pending" ? (
        <InlineAction action={setTermStatusAction} fields={{ id: term.id, status: "retired" }} label={t("retire")} variant="ghost" />
      ) : null}
      {term.status === "retired" ? (
        <InlineAction action={setTermStatusAction} fields={{ id: term.id, status: "active" }} label={t("restore")} variant="ghost" />
      ) : null}
      {term.status !== "merged" ? (
        <Button asChild size="sm" variant="secondary">
          <Link href={`/admin/taxonomy/${term.id}`}>{t("edit")}</Link>
        </Button>
      ) : null}
    </div>
  );

  const row = (term: AdminTerm) => (
    <li key={term.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{term.name}</span>
          <span className="font-mono text-xs text-ink-subtle">{term.slug}</span>
          <Badge>{tKinds(term.kind)}</Badge>
          <Badge variant={term.status === "active" ? "success" : term.status === "pending" ? "accent" : "neutral"}>
            {t(`statuses.${term.status as "active"}`)}
          </Badge>
        </div>
        {term.aliases.length > 0 ? <p className="truncate text-sm text-ink-muted">{term.aliases.join(", ")}</p> : null}
      </div>
      {actions(term)}
    </li>
  );

  return (
    <div className="grid max-w-5xl gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
          <p className="text-ink-muted">{t("intro")}</p>
        </div>
        <Button asChild>
          <Link href="/admin/taxonomy/new">{t("new")}</Link>
        </Button>
      </div>

      <section aria-labelledby="suggestions" className="grid gap-3">
        <h2 id="suggestions" className="font-semibold">
          {`${t("suggestions")} (${suggestions.length})`}
        </h2>
        {suggestions.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("noSuggestions")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">{suggestions.map(row)}</ul>
        )}
      </section>

      <section aria-labelledby="terms" className="grid gap-3">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="grid w-48 gap-1.5">
            <Label htmlFor="tax-kind">{t("filterKind")}</Label>
            <NativeSelect id="tax-kind" name="kind" defaultValue={kind ?? ""}>
              <option value="">{t("all")}</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {tKinds(k)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid w-48 gap-1.5">
            <Label htmlFor="tax-status">{t("filterStatus")}</Label>
            <NativeSelect id="tax-status" name="status" defaultValue={status ?? ""}>
              <option value="">{t("all")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" variant="secondary">
            {t("filterStatus")}
          </Button>
        </form>
        <h2 id="terms" className="sr-only">
          {t("title")}
        </h2>
        {terms.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">{terms.map(row)}</ul>
        )}
      </section>
    </div>
  );
}
