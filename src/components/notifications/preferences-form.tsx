"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/form-parts";
import { FormActions, FormStatus } from "@/components/forms/fields";
import { idleState, type ActionState } from "@/server/modules/shared/action-state";

export type PreferenceGroup = {
  category: string;
  label: string;
  rows: {
    key: string;
    label: string;
    configurable: boolean;
    channels: { channel: "in_app" | "email"; enabled: boolean }[];
  }[];
};

export function PreferencesForm({
  action,
  groups,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  groups: PreferenceGroup[];
}) {
  const t = useTranslations("notifications.preferences");
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="grid gap-6">
      <FormStatus state={state} />
      {groups.map((group) => (
        <fieldset key={group.category} className="grid gap-2">
          <legend className="mb-2 font-semibold">{group.label}</legend>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  <th scope="col" className="p-3 text-start font-medium">
                    <span className="sr-only">{group.label}</span>
                  </th>
                  <th scope="col" className="w-24 p-3 text-center font-medium">
                    {t("inApp")}
                  </th>
                  <th scope="col" className="w-24 p-3 text-center font-medium">
                    {t("email")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.key} className="border-b border-line last:border-b-0">
                    <th scope="row" className="p-3 text-start font-normal">
                      {row.label}
                    </th>
                    {(["in_app", "email"] as const).map((channel) => {
                      const setting = row.channels.find((c) => c.channel === channel);
                      if (!setting) return <td key={channel} className="p-3 text-center text-ink-muted">—</td>;
                      if (!row.configurable) {
                        return (
                          <td key={channel} className="p-3 text-center text-xs text-ink-muted">
                            {setting.enabled ? t("always") : "—"}
                          </td>
                        );
                      }
                      const name = `${row.key}:${channel}`;
                      return (
                        <td key={channel} className="p-3 text-center">
                          <input type="hidden" name="shown" value={name} />
                          <input
                            type="checkbox"
                            name={name}
                            defaultChecked={setting.enabled}
                            aria-label={`${row.label}: ${channel === "email" ? t("email") : t("inApp")}`}
                            className="size-4 accent-[var(--color-accent)]"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      ))}
      <FormActions>
        <SubmitButton>{t("save")}</SubmitButton>
      </FormActions>
    </form>
  );
}
