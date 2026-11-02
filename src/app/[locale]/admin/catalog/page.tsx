import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ContentStatusForm } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { setContentStatusAction } from "@/server/modules/admin/actions";
import { searchCatalog } from "@/server/modules/admin/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.catalog");
  return { title: t("title") };
}

export default function CatalogAdminPage({ searchParams }: PageProps<"/[locale]/admin/catalog">) {
  return (
    <Suspense>
      <Catalog searchParams={searchParams} />
    </Suspense>
  );
}

async function Catalog({ searchParams }: { searchParams: PageProps<"/[locale]/admin/catalog">["searchParams"] }) {
  await requireStaff(["super_admin", "admin", "moderator"], "/admin/catalog");
  const session = await getSessionClaims();
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 80) : "";
  const status = raw.status === "suspended" || raw.status === "live" ? raw.status : null;
  const [t, tProvider, tListing] = await Promise.all([
    getTranslations("admin.catalog"),
    getTranslations("dashboard.expert.statuses"),
    getTranslations("expert.services.statuses"),
  ]);
  if (!session) return null;
  const results = await searchCatalog(session.supabase, q || null, status);

  return (
    <div className="grid max-w-5xl gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-ink-muted">{t("intro")}</p>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-64 flex-1 gap-1.5">
          <Label htmlFor="catalog-q">{t("search")}</Label>
          <Input id="catalog-q" name="q" type="search" defaultValue={q} maxLength={80} />
        </div>
        <div className="grid w-48 gap-1.5">
          <Label htmlFor="catalog-status">{t("statusFilter")}</Label>
          <NativeSelect id="catalog-status" name="status" defaultValue={status ?? ""}>
            <option value="">{t("anyStatus")}</option>
            <option value="live">{tListing("published")}</option>
            <option value="suspended">{tListing("suspended")}</option>
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">
          {t("search")}
        </Button>
      </form>

      <section aria-labelledby="providers" className="grid gap-3">
        <h2 id="providers" className="font-semibold">
          {t("providers")}
        </h2>
        {results.providers.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {results.providers.map((p) => (
              <li key={p.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_18rem]">
                <div className="grid gap-1">
                  <Link href={`/experts/${p.handle}`} className="font-medium hover:text-accent">
                    {p.display_name}
                  </Link>
                  <div>
                    <Badge variant={p.status === "active" ? "success" : p.status === "suspended" ? "warning" : "neutral"}>
                      {tProvider(p.status)}
                    </Badge>
                  </div>
                </div>
                {p.status === "active" || p.status === "suspended" ? (
                  <ContentStatusForm action={setContentStatusAction} targetType="provider" targetId={p.id} suspended={p.status === "suspended"} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="listings" className="grid gap-3">
        <h2 id="listings" className="font-semibold">
          {t("listings")}
        </h2>
        {results.listings.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {results.listings.map((l) => (
              <li key={l.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_18rem]">
                <div className="grid gap-1">
                  {l.providers ? (
                    <Link href={`/experts/${l.providers.handle}/${l.slug}`} className="font-medium hover:text-accent">
                      {l.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{l.title}</span>
                  )}
                  <div className="flex items-center gap-2 text-sm text-ink-muted">
                    <Badge variant={l.status === "published" ? "success" : l.status === "suspended" ? "warning" : "neutral"}>
                      {tListing(l.status)}
                    </Badge>
                    {l.providers ? <span>{l.providers.display_name}</span> : null}
                  </div>
                </div>
                {l.status === "published" || l.status === "suspended" || l.status === "paused" ? (
                  <ContentStatusForm action={setContentStatusAction} targetType="listing" targetId={l.id} suspended={l.status === "suspended"} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
