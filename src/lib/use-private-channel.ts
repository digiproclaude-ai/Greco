"use client";

import { useEffect, useRef } from "react";

import { getBrowserSupabase } from "@/lib/supabase-browser";

/**
 * Subscribe to a private Realtime Broadcast topic ("user:<id>" or "conversation:<id>"). The
 * database decides who may join (RLS on realtime.messages), so a wrong topic just never fires.
 * Failures are silent: pages still work, they just don't update live.
 */
export function usePrivateChannel(topic: string, event: string, onEvent: () => void) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabase();
    const channel = supabase.channel(topic, { config: { private: true } });
    void supabase.realtime
      .setAuth()
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        channel.on("broadcast", { event }, () => handler.current()).subscribe();
      });
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [topic, event]);
}
