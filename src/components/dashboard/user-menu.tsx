"use client";

import { LogOut, ShieldCheck, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/server/modules/identity/actions";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({ name, email, isStaff }: { name: string; email: string | null; isStaff: boolean }) {
  const t = useTranslations("nav");
  const [signingOut, startSignOut] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("accountMenu")}
        className="grid size-9 place-items-center rounded-full bg-accent-tint text-sm font-semibold text-accent"
      >
        {initials(name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block text-sm font-medium text-ink">{name}</span>
          {email ? <span className="block truncate">{email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings/security">
            <ShieldCheck aria-hidden="true" />
            {t("security")}
          </Link>
        </DropdownMenuItem>
        {isStaff ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Wrench aria-hidden="true" />
              {t("admin")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {/* The menu unmounts on select, so a <form> inside it would never submit: call the action directly. */}
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={() => startSignOut(async () => await signOutAction())}
        >
          <LogOut aria-hidden="true" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
