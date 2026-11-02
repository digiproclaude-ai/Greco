import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireUser } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { toggleSavedAction } from "@/server/modules/saved/actions";
import { listSaved } from "@/server/modules/saved/service";
import { getCategories } from "@/server/modules/taxonomy/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.saved");
  return { title: t("title") };
}

function RemoveForm({ kind, id, label }: { kind: string; id: string; label: string }) {
  return (
    <form action={toggleSavedAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="saved" value="1" />
      <button type="submit" className="text-sm text-accent hover:underline">
        {label}
      </button>
    </form>
  );
}

export default async function SavedPage() {
  const account = await requireUser("/dashboard/saved");
  const session = await getSessionClaims();
  const [t, tForms, locale] = await Promise.all([getTranslations("client.saved"), getTranslations("forms"), getLocale()]);
  if (!session) return null;
  const [saved, categories] = await Promise.all([listSaved(session.supabase, account.userId), getCategories(locale)]);
  const savedCategories = categories.filter((category) => saved.categoryIds.includes(category.id));

  const sections = [
    {
      key: "experts",
      items: saved.providers.map((provider) => ({
        id: provider.id,
        kind: "provider",
        title: provider.display_name,
        subtitle: provider.headline,
        href: provider.status === "active" ? `/experts/${provider.handle}` : null,
      })),
    },
    {
      key: "services",
      items: saved.services.map((service) => ({
        id: service.id,
        kind: "listing",
        title: service.title,
        subtitle: service.providers ? t("by", { name: service.providers.display_name }) : null,
        href: service.status === "published" && service.providers ? `/experts/${service.providers.handle}/${service.slug}` : null,
      })),
    },
    {
      key: "categories",
      items: savedCategories.map((category) => ({
        id: category.id,
        kind: "category",
        title: category.name,
        subtitle: category.shortDescription,
        href: `/categories/${category.urlPath}`,
      })),
    },
  ] as const;

  return (
    <div className="grid max-w-3xl gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-ink-muted">{t("intro")}</p>
      </div>
      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`saved-${section.key}`} className="grid gap-3">
          <h2 id={`saved-${section.key}`} className="font-semibold">
            {t(section.key)}
          </h2>
          {section.items.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("empty")}</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {section.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="grid min-w-0 gap-0.5">
                    {item.href ? (
                      <Link href={item.href} className="font-medium hover:text-accent">
                        {item.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink-muted">{`${item.title} · ${t("unavailable")}`}</span>
                    )}
                    {item.subtitle ? <span className="truncate text-sm text-ink-muted">{item.subtitle}</span> : null}
                  </div>
                  <RemoveForm kind={item.kind} id={item.id} label={tForms("remove")} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
