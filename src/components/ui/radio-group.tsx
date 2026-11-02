"use client";

import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-3", className)} {...props} />
  );
}

/** A radio option rendered as a selectable card with a title and description. */
export function RadioCard({
  className,
  title,
  description,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Item> & { title: string; description?: string }) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-card"
      className={cn(
        "group grid grid-cols-[18px_1fr] gap-3 rounded-lg border border-control bg-surface p-4 text-start transition-colors hover:bg-paper data-[state=checked]:border-accent data-[state=checked]:bg-accent-tint aria-invalid:border-danger",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-[18px] place-items-center rounded-full border border-control bg-surface group-data-[state=checked]:border-accent"
      >
        <RadioGroupPrimitive.Indicator className="size-2.5 rounded-full bg-accent" />
      </span>
      <span className="grid gap-0.5">
        <span className="font-semibold">{title}</span>
        {description ? <span className="text-sm text-ink-muted">{description}</span> : null}
      </span>
    </RadioGroupPrimitive.Item>
  );
}
