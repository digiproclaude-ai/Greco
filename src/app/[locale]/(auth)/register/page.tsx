import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import { RegisterForm, type CountryOption } from "@/components/auth/register-form";
import { Alert } from "@/components/ui/alert";
import { getPublicEnv } from "@/lib/env";
import { createSupabaseAnonClient } from "@/server/db/supabase-server";

import { AuthHeading } from "../auth-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("register") };
}

/** Country codes open for registration (admin-managed; blocked countries are excluded). */
async function registrableCountryCodes(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  const { data, error } = await createSupabaseAnonClient()
    .from("countries")
    .select("code")
    .eq("can_register", true);
  // Throwing keeps a failed lookup out of the cache; the error boundary offers a retry.
  if (error) throw new Error(`Could not load countries: ${error.message}`);
  return data.map((row) => row.code);
}

async function countryOptions(locale: string): Promise<CountryOption[]> {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const collator = new Intl.Collator(locale);
  return (await registrableCountryCodes())
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

export default async function RegisterPage({ searchParams }: PageProps<"/[locale]/register">) {
  const params = await searchParams;
  const [t, locale] = await Promise.all([getTranslations("auth.register"), getLocale()]);
  const countries = await countryOptions(locale);
  const defaultRole = params.role === "expert" || params.role === "client" ? params.role : null;

  return (
    <>
      <AuthHeading title={t("title")} description={t("description")} />
      <div className="grid gap-4">
        {params.google === "incomplete" ? <Alert variant="warning">{t("googleIncomplete")}</Alert> : null}
        <RegisterForm
          countries={countries}
          defaultRole={defaultRole}
          googleEnabled={getPublicEnv().NEXT_PUBLIC_AUTH_GOOGLE_ENABLED}
        />
      </div>
    </>
  );
}
