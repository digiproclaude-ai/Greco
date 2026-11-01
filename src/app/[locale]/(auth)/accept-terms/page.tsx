import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SubmitButton } from "@/components/auth/form-parts";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { acceptTermsAction } from "@/server/modules/identity/actions";

import { AuthHeading } from "../auth-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("acceptTerms") };
}

export default async function AcceptTermsPage({ searchParams }: PageProps<"/[locale]/accept-terms">) {
  const params = await searchParams;
  const t = await getTranslations("auth");
  const tValidation = await getTranslations("validation");

  return (
    <>
      <AuthHeading title={t("acceptTerms.title")} description={t("acceptTerms.description")} />
      <form action={acceptTermsAction} className="grid gap-5">
        <input type="hidden" name="next" value={safeNextPath(params.next)} />
        {params.error === "legal" ? <Alert variant="danger">{tValidation("legal")}</Alert> : null}
        {params.error === "generic" ? <Alert variant="danger">{t("errors.generic")}</Alert> : null}
        <div className="flex items-start gap-3">
          <Checkbox id="field-legal" name="legal" value="on" required />
          <Label htmlFor="field-legal" className="font-normal">
            {t.rich("acceptTerms.checkbox", {
              terms: (chunks) => (
                <Link href="/legal/terms" target="_blank" className="text-accent underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/legal/privacy" target="_blank" className="text-accent underline">
                  {chunks}
                </Link>
              ),
            })}
          </Label>
        </div>
        <SubmitButton size="lg">{t("acceptTerms.submit")}</SubmitButton>
      </form>
    </>
  );
}
