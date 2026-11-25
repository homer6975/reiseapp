import { householdCalendar } from "@/server/export/ics";

// ICS-Feed zum Abonnieren (SPEC §6.8). Öffentlich erreichbar, geschützt nur durch das Token.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/ics/[token]">,
) {
  const { token } = await params;
  const ics = await householdCalendar(token.replace(/\.ics$/, ""));
  if (!ics) return new Response("Not found", { status: 404 });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="familien-trips.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
