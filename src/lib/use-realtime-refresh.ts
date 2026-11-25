"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Lädt die Seite neu (router.refresh), sobald sich in `table` etwas zur Reise
 * ändert (ZE-02). RLS gilt auch für Realtime: jeder sieht nur, was er lesen darf.
 */
export function useRealtimeRefresh(
  table: "day_item" | "packing_item",
  tripId: string,
) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 100);
    };
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session)
        await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`${table}-${tripId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `trip_id=eq.${tripId}`,
          },
          schedule,
        )
        // Löschungen lassen sich nicht filtern.
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table },
          schedule,
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [table, tripId, router]);
}
