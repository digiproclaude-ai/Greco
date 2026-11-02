import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { controlClasses } from "./input";

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea data-slot="textarea" rows={rows} className={cn("py-2 leading-relaxed", controlClasses, className)} {...props} />
  );
}
