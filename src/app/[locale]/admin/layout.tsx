import { Suspense } from "react";

import { DashboardFallback, DashboardFrame } from "@/components/dashboard/dashboard-frame";

export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardFrame area="admin">{children}</DashboardFrame>
    </Suspense>
  );
}
