import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("grid grid-cols-[20px_1fr] gap-3 rounded-lg border p-4 text-[15px]", {
  variants: {
    variant: {
      info: "border-accent/30 bg-accent-tint text-ink",
      success: "border-success/30 bg-success/5 text-ink",
      warning: "border-warning/30 bg-warning/5 text-ink",
      danger: "border-danger/30 bg-danger/5 text-ink",
    },
  },
  defaultVariants: { variant: "info" },
});

const icons = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };
const iconColors = {
  info: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function Alert({
  className,
  variant,
  title,
  children,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants> & { title?: string }) {
  const key = variant ?? "info";
  const Icon = icons[key];
  return (
    <div
      role={key === "danger" ? "alert" : "status"}
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className={cn("mt-0.5 size-5", iconColors[key])} aria-hidden="true" />
      <div className="grid gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-ink-muted">{children}</div> : null}
      </div>
    </div>
  );
}
