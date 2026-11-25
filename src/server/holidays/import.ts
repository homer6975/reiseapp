import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  germanName,
  getPublicHolidays,
  getSchoolHolidays,
} from "@/server/integrations/openholidays";

export type ImportResult = { schoolHolidays: number; publicHolidays: number };

// Importiert Schulferien und Feiertage für das laufende und die zwei folgenden Jahre
// (drei Jahre = Höchstzeitraum der API). Upsert über (source, external_id).
// Läuft mit Service-Role: Landesdaten gehören keinem Haushalt.
export async function importHolidays(
  stateCode: string,
  year = new Date().getFullYear(),
): Promise<ImportResult> {
  const from = `${year}-01-01`;
  const to = `${year + 2}-12-31`;
  const [school, pub] = await Promise.all([
    getSchoolHolidays(stateCode, from, to),
    getPublicHolidays(stateCode, from, to),
  ]);

  const rows = [
    ...school.map((h) => ({ h, kind: "school_holiday" as const })),
    ...pub.map((h) => ({ h, kind: "public_holiday" as const })),
  ].map(({ h, kind }) => ({
    kind,
    state_code: stateCode,
    school_id: null,
    name: germanName(h),
    start_date: h.startDate,
    end_date: h.endDate,
    source: "openholidays",
    external_id: h.id,
  }));

  if (rows.length > 0) {
    const db = createServiceClient();
    const { error } = await db
      .from("holiday_period")
      .upsert(rows, { onConflict: "source,external_id" });
    if (error) throw new Error(`Ferien speichern: ${error.message}`);
  }

  return { schoolHolidays: school.length, publicHolidays: pub.length };
}
