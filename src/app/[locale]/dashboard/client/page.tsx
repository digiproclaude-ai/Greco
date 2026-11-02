import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ClientProfileForm } from "@/components/client/client-profile-form";
import { EditorSection } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth/guards";
import { displayNameOf, getSessionClaims } from "@/server/auth/session";
import { industryOptions } from "@/server/modules/taxonomy/labels";
import { getActiveTerms } from "@/server/modules/taxonomy/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.client");
  return { title: t("title") };
}

const EXPLORE = [
  { key: "browse", href: "/categories" },
  { key: "search", href: "/search" },
  { key: "experts", href: "/experts" },
] as const;

export default async function ClientWorkspacePage() {
  const account = await requireRole("client", "/dashboard/client");
  const session = await getSessionClaims();
  const [t, tClient, tCommon, locale] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("client"),
    getTranslations("common"),
    getLocale(),
  ]);
  if (!session) return null;
  const [{ data: profile }, terms] = await Promise.all([
    session.supabase.from("client_profiles").select("*").eq("user_id", account.userId).maybeSingle(),
    getActiveTerms(locale),
  ]);
  const onboarded = Boolean(profile?.onboarding_completed_at);

  return (
    <div className="grid max-w-3xl gap-8">
      <div className="grid gap-2">
        <p className="text-sm font-medium text-ink-muted">{t("client.title")}</p>
        <h1 className="font-display text-3xl font-semibold">{t("greeting", { name: displayNameOf(account) })}</h1>
        <p className="text-ink-muted">{onboarded ? t("client.intro") : tClient("profile.welcome")}</p>
      </div>

      {onboarded ? (
        <section aria-labelledby="explore" className="grid gap-3">
          <h2 id="explore" className="font-semibold">
            {tClient("explore.title")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {EXPLORE.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="grid h-full gap-1 rounded-lg border border-line bg-surface p-4 hover:border-accent"
                >
                  <span className="font-medium">{tClient(`explore.${item.key}`)}</span>
                  <span className="text-sm text-ink-muted">{tClient(`explore.${item.key}Body`)}</span>
                </Link>
              </li>
            ))}
            <li className="grid gap-1 rounded-lg border border-dashed border-line bg-surface p-4">
              <span className="flex items-center gap-2 font-medium">
                {tClient("explore.discovery")}
                <Badge>{tCommon("comingSoon")}</Badge>
              </span>
              <span className="text-sm text-ink-muted">{tClient("explore.discoveryBody")}</span>
            </li>
          </ul>
        </section>
      ) : null}

      <EditorSection id="client-profile" title={tClient("profile.title")} description={tClient("profile.intro")}>
        <ClientProfileForm
          industries={industryOptions(terms)}
          values={{
            accountType: profile?.account_type ?? null,
            businessName: profile?.business_name ?? null,
            industry: profile?.industry_term_id ?? null,
            companySize: profile?.company_size ?? null,
            website: profile?.website_url ?? null,
            purpose: profile?.purpose ?? null,
            challenges: profile?.challenges ?? null,
          }}
        />
      </EditorSection>
    </div>
  );
}
