"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

import { usePrivateChannel } from "@/lib/use-private-channel";

/** Refreshes the page data (sidebar badges included) when a notification arrives for this user. */
export function LiveCounts({ userId }: { userId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEvent = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 400);
  }, [router]);
  usePrivateChannel(`user:${userId}`, "notification", onEvent);
  return null;
}
