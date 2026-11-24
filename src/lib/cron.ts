import "server-only";

import { cronSecret } from "@/lib/env";

// Vercel Cron schickt `Authorization: Bearer ${CRON_SECRET}` (SPEC §3).
export function isAuthorizedCron(request: Request): boolean {
  const header = request.headers.get("authorization");
  return header === `Bearer ${cronSecret()}`;
}
