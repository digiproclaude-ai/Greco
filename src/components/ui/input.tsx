import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const controlClasses =
  "w-full min-w-0 rounded-md border border-control bg-surface px-3 text-[15px] text-ink placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input type={type} data-slot="input" className={cn("h-10", controlClasses, className)} {...props} />
  );
}
