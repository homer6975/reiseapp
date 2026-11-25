"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Lädt die Seite neu (router.refresh), sobald sich in `table` etwas zur Reise
 * ändert (ZE-02). RLS gilt auch für Realtime: jeder sieht nur, was er lesen darf.
 */
type Table = "day_item" | "packing_item" | "poll" | "poll_option" | "vote";
// Tabellen ohne trip_id lassen sich nicht nach Reise filtern.
const WITH_TRIP_ID: readonly Table[] = ["day_item", "packing_item", "poll"];

export function useRealtimeRefresh(tables: Table | Table[], tripId: string) {
  const key = ([] as Table[]).concat(tables).join(",");
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
      channel = supabase.channel(`${key}-${tripId}`);
      for (const table of key.split(",") as Table[]) {
        if (WITH_TRIP_ID.includes(table)) {
          channel
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
            );
        } else {
          channel.on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            schedule,
          );
        }
      }
      channel.subscribe();
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key, tripId, router]);
}
