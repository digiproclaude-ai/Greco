import {
  Bell,
  Bookmark,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  Flag,
  FolderKanban,
  FolderTree,
  Gavel,
  LayoutDashboard,
  MessageSquare,
  Search,
  ShieldCheck,
  Store,
  Tags,
  UserRound,
  Wrench,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Logo } from "@/components/layout/logo";
import { requireUser } from "@/server/auth/guards";
import { displayNameOf, getSessionClaims, hasActiveRole, type Account } from "@/server/auth/session";

import { LiveCounts } from "./live-counts";
import { NavLink } from "./nav-link";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

type NavItem = { href: string; label: string; icon: ReactNode; exact?: boolean; count?: number };

type Counts = { notifications: number; messages: number };

async function myCounts(): Promise<Counts> {
  const session = await getSessionClaims();
  if (!session) return { notifications: 0, messages: 0 };
  const { data } = await session.supabase.rpc("my_counts");
  const counts = (data ?? {}) as Partial<Counts>;
  return { notifications: Number(counts.notifications ?? 0), messages: Number(counts.messages ?? 0) };
}

async function workspaceNav(account: Account, counts: Counts): Promise<NavItem[]> {
  const [t, tExpert, tProjects] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("expert.nav"),
    getTranslations("projects.nav"),
  ]);
  const role = account.profile.active_role;
  const items: NavItem[] = [
    { href: `/dashboard/${role}`, label: t("overview"), icon: <LayoutDashboard aria-hidden="true" />, exact: true },
  ];
  if (role === "expert" && hasActiveRole(account, "expert")) {
    items.push(
      { href: "/dashboard/expert/projects", label: tProjects("board"), icon: <Search aria-hidden="true" /> },
      { href: "/dashboard/expert/proposals", label: tProjects("proposals"), icon: <FileText aria-hidden="true" /> },
      { href: "/dashboard/expert/profile", label: tExpert("profile"), icon: <UserRound aria-hidden="true" /> },
      { href: "/dashboard/expert/services", label: tExpert("services"), icon: <BriefcaseBusiness aria-hidden="true" /> },
      { href: "/dashboard/expert/portfolio", label: tExpert("portfolio"), icon: <FolderKanban aria-hidden="true" /> },
    );
  }
  if (role === "client" && hasActiveRole(account, "client")) {
    items.push({ href: "/dashboard/client/projects", label: tProjects("projects"), icon: <ClipboardList aria-hidden="true" /> });
  }
  items.push(
    { href: "/dashboard/messages", label: tProjects("messages"), icon: <MessageSquare aria-hidden="true" />, count: counts.messages },
    {
      href: "/dashboard/notifications",
      label: tProjects("notifications"),
      icon: <Bell aria-hidden="true" />,
      count: counts.notifications,
    },
    { href: "/dashboard/saved", label: t("saved"), icon: <Bookmark aria-hidden="true" /> },
    { href: "/dashboard/settings/security", label: t("security"), icon: <ShieldCheck aria-hidden="true" /> },
  );
  if (account.staffRoles.length > 0) {
    items.push({ href: "/admin", label: t("admin"), icon: <Wrench aria-hidden="true" /> });
  }
  return items;
}

async function adminNav(account: Account): Promise<NavItem[]> {
  const t = await getTranslations("admin.nav");
  return [
    { href: "/admin", label: t("overview"), icon: <LayoutDashboard aria-hidden="true" />, exact: true },
    { href: "/admin/moderation", label: t("moderation"), icon: <Gavel aria-hidden="true" /> },
    { href: "/admin/reports", label: t("reports"), icon: <Flag aria-hidden="true" /> },
    { href: "/admin/catalog", label: t("catalog"), icon: <Store aria-hidden="true" /> },
    { href: "/admin/categories", label: t("categories"), icon: <FolderTree aria-hidden="true" /> },
    { href: "/admin/taxonomy", label: t("taxonomy"), icon: <Tags aria-hidden="true" /> },
    { href: `/dashboard/${account.profile.active_role}`, label: t("backToWorkspace"), icon: <UserRound aria-hidden="true" /> },
  ];
}

/** Authenticated app shell. Reads the session, so layouts render it inside Suspense. */
export async function DashboardFrame({ children, area = "workspace" }: { children: ReactNode; area?: "workspace" | "admin" }) {
  const account = await requireUser(area === "admin" ? "/admin" : "/dashboard");
  const t = await getTranslations("dashboard");
  const workspaceHref = `/dashboard/${account.profile.active_role}`;
  const counts = area === "admin" ? { notifications: 0, messages: 0 } : await myCounts();
  const items = area === "admin" ? await adminNav(account) : await workspaceNav(account, counts);

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
        <nav
          aria-label={area === "admin" ? t("adminNavLabel") : t("sidebarLabel")}
          className="overflow-x-auto border-b border-line bg-surface p-3 md:w-60 md:shrink-0 md:border-e md:border-b-0"
        >
          <ul className="flex gap-1 md:flex-col">
            {items.map((item) => (
              <li key={item.href} className="shrink-0">
                <NavLink href={item.href} exact={item.exact}>
                  {item.icon}
                  {item.label}
                  {item.count ? (
                    <span className="ms-auto rounded-full bg-accent px-1.5 text-xs font-semibold text-white">
                      <span aria-hidden="true">{item.count > 99 ? "99+" : item.count}</span>
                      <span className="sr-only">{t("unread", { count: item.count })}</span>
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" className="min-w-0 flex-1 px-4 py-8 sm:px-8">
          {children}
        </main>
        {area === "workspace" ? <LiveCounts userId={account.userId} /> : null}
      </div>
    </div>
  );
}

export function DashboardFallback() {
  return <div className="flex-1 bg-paper" aria-busy="true" />;
}
