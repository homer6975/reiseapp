import {
  fileName,
  loadSettlement,
  settlementCsv,
} from "@/server/costs/settlement";

// CSV-Export der Abrechnung (AU-07). Nur Eltern.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/reisen/[id]/kosten/export">,
) {
  const { id } = await params;
  const s = await loadSettlement(id);
  if (!s) return new Response("Not found", { status: 404 });
  return new Response(settlementCsv(s), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": fileName(s, "csv"),
      "Cache-Control": "private, no-store",
    },
  });
}
