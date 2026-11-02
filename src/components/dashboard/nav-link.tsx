"use client";

import type { ReactNode } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children, exact = false }: { href: string; children: ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || (!exact && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-[15px] text-ink-muted hover:bg-paper hover:text-ink [&_svg]:size-4",
        active && "bg-accent-tint font-medium text-accent hover:bg-accent-tint hover:text-accent",
      )}
    >
      {children}
    </Link>
  );
}
