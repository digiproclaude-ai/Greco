import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Vertical stack for a label, control, hint and error. */
export function Field({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="field" className={cn("grid gap-1.5", className)} {...props} />;
}

export function FieldHint({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm text-ink-muted", className)} {...props} />;
}

export function FieldError({ className, children, ...props }: ComponentProps<"p">) {
  if (!children) return null;
  return (
    <p className={cn("text-sm font-medium text-danger", className)} {...props}>
      {children}
    </p>
  );
}
