import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("font-display text-2xl font-semibold tracking-tight text-ink", className)}
    >
      Greco<span className="text-accent">.</span>
    </Link>
  );
}
