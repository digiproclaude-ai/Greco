import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";
import { hasActiveRole, type Account, type MarketplaceRole } from "@/server/auth/session";
import { switchWorkspaceAction } from "@/server/modules/identity/workspace-actions";

const ROLES: MarketplaceRole[] = ["client", "expert"];

/** Client/Expert workspace switch. Adds the second role in one click (D-05). */
export async function WorkspaceSwitcher({ account }: { account: Account }) {
  const t = await getTranslations("dashboard.workspace");
  return (
    <div role="group" aria-label={t("label")} className="inline-flex overflow-hidden rounded-md border border-line text-sm">
      {ROLES.map((role) => {
        const active = account.profile.active_role === role;
        const enabled = hasActiveRole(account, role);
        const label = enabled ? t(role) : t(role === "client" ? "addClient" : "addExpert");
        return (
          <form key={role} action={switchWorkspaceAction}>
            <input type="hidden" name="role" value={role} />
            {enabled ? null : <input type="hidden" name="enable" value="1" />}
            <button
              type="submit"
              aria-pressed={active}
              disabled={active}
              title={enabled && !active ? t("switchTo", { role: t(role) }) : undefined}
              className={cn(
                "px-3 py-1.5 transition-colors",
                active ? "bg-accent-tint font-semibold text-accent" : "text-ink-muted hover:bg-paper hover:text-ink",
              )}
            >
              {label}
            </button>
          </form>
        );
      })}
    </div>
  );
}
