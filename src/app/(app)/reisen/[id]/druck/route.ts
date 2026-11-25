import { z } from "zod";

import { getMe } from "@/lib/auth";
import { summarize } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { loadCosts } from "@/server/costs/data";
import { renderTripPdf } from "@/server/export/trip-pdf";
import { loadPersons } from "@/server/planner/data";
import { loadPlanItems, loadTrip } from "@/server/trips/data";

// Reise als PDF (RP-10). Kostenblock nur für Eltern und nur mit ?kosten=1.
export async function GET(
  request: Request,
  { params }: RouteContext<"/reisen/[id]/druck">,
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Not found", { status: 404 });
  const me = await getMe();
  const supabase = await createClient();
  const trip = await loadTrip(supabase, me.householdId, id);
  if (!trip) return new Response("Not found", { status: 404 });

  const withCosts =
    me.isParent && new URL(request.url).searchParams.get("kosten") === "1";
  const [items, persons, costs] = await Promise.all([
    loadPlanItems(supabase, trip.id),
    loadPersons(supabase, me.householdId),
    withCosts ? loadCosts(supabase, trip.id) : null,
  ]);
  const memberIds = new Set(trip.members.map((m) => m.personId));
  const pdf = await renderTripPdf({
    trip,
    items,
    members: persons.filter((p) => memberIds.has(p.id)).map((p) => p.name),
    costs: costs ? summarize(costs.expenses, costs.budget) : null,
  });
  const name = trip.title.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "Reise";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}.pdf`,
      "Cache-Control": "private, no-store",
    },
  });
}
