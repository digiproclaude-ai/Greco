"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { usePrivateChannel } from "@/lib/use-private-channel";

/**
 * Keeps an open conversation current: marks it read on open and on every new message, and
 * refreshes the server-rendered thread when the other person writes.
 */
export function ConversationLive({
  conversationId,
  markRead,
  lastMessageId,
}: {
  conversationId: string;
  markRead: () => Promise<void>;
  lastMessageId: string | null;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void markRead();
    document.getElementById("thread-end")?.scrollIntoView({ block: "end" });
  }, [markRead, lastMessageId]);

  const onMessage = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 250);
  }, [router]);
  usePrivateChannel(`conversation:${conversationId}`, "message", onMessage);
  return null;
}
