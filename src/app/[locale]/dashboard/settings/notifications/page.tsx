import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PreferencesForm, type PreferenceGroup } from "@/components/notifications/preferences-form";
import { Alert } from "@/components/ui/alert";
import { requireUser } from "@/server/auth/guards";
import { getSessionClaims } from "@/server/auth/session";
import { emailConfigured } from "@/server/adapters/email";
import { savePreferencesAction } from "@/server/modules/notifications/actions";
import { getPreferences } from "@/server/modules/notifications/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications.preferences");
  return { title: t("title") };
}

const CATEGORIES = ["projects", "messages", "saved", "account"] as const;

export default async function NotificationSettingsPage() {
  const account = await requireUser("/dashboard/settings/notifications");
  const session = await getSessionClaims();
  if (!session) return null;
  const t = await getTranslations("notifications.preferences");
  const label = t as unknown as (key: string) => string;
  const rows = await getPreferences(session.supabase, account.userId);
  const groups: PreferenceGroup[] = CATEGORIES.map((category) => ({
    category,
    label: t(`categories.${category}`),
    rows: rows
      .filter((row) => row.category === category)
      .map((row) => ({ key: row.key, label: label(`types.${row.key}`), configurable: row.configurable, channels: row.channels })),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-ink-muted">{t("intro")}</p>
      </div>
      {!emailConfigured() ? <Alert>{t("emailNotConfigured")}</Alert> : null}
      <div className="rounded-lg border border-line bg-surface p-5">
        <PreferencesForm action={savePreferencesAction} groups={groups} />
      </div>
    </div>
  );
}
