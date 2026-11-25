import { z } from "zod";

import { getMe } from "@/lib/auth";
import { geocode, orsMessage } from "@/server/integrations/ors";

const query = z.object({
  q: z.string().trim().min(3).max(200),
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .nullable(),
});

// Ortssuche für den Eintrag-Dialog (KA-03). Nur Eltern legen Einträge an.
export async function GET(request: Request) {
  const me = await getMe();
  if (!me.isParent) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const parsed = query.safeParse({
    q: url.searchParams.get("q") ?? "",
    country: url.searchParams.get("country"),
  });
  if (!parsed.success) return Response.json({ results: [] });
  try {
    const results = await geocode(parsed.data.q, {
      country: parsed.data.country,
    });
    return Response.json({ results });
  } catch (error) {
    return Response.json(
      { results: [], error: orsMessage(error) },
      { status: 502 },
    );
  }
}
