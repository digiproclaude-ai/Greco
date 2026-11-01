import { Suspense } from "react";

import { DashboardFallback, DashboardFrame } from "@/components/dashboard/dashboard-frame";

export default function DashboardLayout({ children }: LayoutProps<"/[locale]/dashboard">) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardFrame>{children}</DashboardFrame>
    </Suspense>
  );
}
