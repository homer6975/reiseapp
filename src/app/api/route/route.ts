import { z } from "zod";

import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { orsMessage } from "@/server/integrations/ors";
import { routeForDay } from "@/server/map/route";

const query = z.object({ trip: z.uuid(), day: z.iso.date() });

// Route eines Reisetags (KA-02), gecacht in route_cache.
export async function GET(request: Request) {
  const me = await getMe();
  const url = new URL(request.url);
  const parsed = query.safeParse({
    trip: url.searchParams.get("trip"),
    day: url.searchParams.get("day"),
  });
  if (!parsed.success)
    return Response.json({ error: "Ungültig." }, { status: 400 });

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trip")
    .select("id")
    .eq("id", parsed.data.trip)
    .eq("household_id", me.householdId)
    .maybeSingle();
  if (!trip)
    return Response.json({ error: "Nicht gefunden." }, { status: 404 });

  try {
    const route = await routeForDay(supabase, trip.id, parsed.data.day);
    return Response.json({ route });
  } catch (error) {
    return Response.json({ error: orsMessage(error) }, { status: 502 });
  }
}
