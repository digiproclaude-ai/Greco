import { LayoutDashboard, ShieldCheck, Wrench } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Logo } from "@/components/layout/logo";
import { requireUser } from "@/server/auth/guards";
import { displayNameOf } from "@/server/auth/session";

import { NavLink } from "./nav-link";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

/** Authenticated app shell. Reads the session, so the dashboard layout renders it inside Suspense. */
export async function DashboardFrame({ children }: { children: ReactNode }) {
  const account = await requireUser("/dashboard");
  const t = await getTranslations("dashboard");
  const workspaceHref = `/dashboard/${account.profile.active_role}`;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Logo href={workspaceHref} />
          <WorkspaceSwitcher account={account} />
          <div className="ms-auto">
            <UserMenu name={displayNameOf(account)} email={account.email} isStaff={account.staffRoles.length > 0} />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav aria-label={t("sidebarLabel")} className="border-b border-line bg-surface p-3 md:w-60 md:border-e md:border-b-0">
          <ul className="flex gap-1 md:flex-col">
            <li>
              <NavLink href={workspaceHref}>
                <LayoutDashboard aria-hidden="true" />
                {t("overview")}
              </NavLink>
            </li>
            <li>
              <NavLink href="/dashboard/settings/security">
                <ShieldCheck aria-hidden="true" />
                {t("security")}
              </NavLink>
            </li>
            {account.staffRoles.length > 0 ? (
              <li>
                <NavLink href="/admin">
                  <Wrench aria-hidden="true" />
                  {t("admin")}
                </NavLink>
              </li>
            ) : null}
          </ul>
        </nav>
        <main id="main" className="flex-1 px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardFallback() {
  return <div className="flex-1 bg-paper" aria-busy="true" />;
}
