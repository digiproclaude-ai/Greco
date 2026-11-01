import { Suspense } from "react";

import { Logo } from "@/components/layout/logo";
import { Skeleton } from "@/components/ui/skeleton";

function FormSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <main id="main" className="flex flex-1 justify-center px-4 py-10 sm:py-16">
      <div className="grid w-full max-w-md content-start gap-8">
        <Logo />
        <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">
          {/* Pages read query parameters and the session, so they render at request time. */}
          <Suspense fallback={<FormSkeleton />}>{children}</Suspense>
        </div>
      </div>
    </main>
  );
}
