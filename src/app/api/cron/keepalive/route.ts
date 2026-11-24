import { isAuthorizedCron } from "@/lib/cron";
import { createServiceClient } from "@/lib/supabase/service";

// Hält das Supabase-Gratisprojekt aktiv: eine leichte Query pro Tag (SPEC §8.2).
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("household").select("id").limit(1);

  if (error) {
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
