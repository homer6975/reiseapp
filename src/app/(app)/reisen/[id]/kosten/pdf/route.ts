import { fileName, loadSettlement } from "@/server/costs/settlement";
import { renderSettlementPdf } from "@/server/costs/settlement-pdf";

// PDF der Abrechnung (AU-07). Nur Eltern.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/reisen/[id]/kosten/pdf">,
) {
  const { id } = await params;
  const s = await loadSettlement(id);
  if (!s) return new Response("Not found", { status: 404 });
  const pdf = await renderSettlementPdf(s);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": fileName(s, "pdf"),
      "Cache-Control": "private, no-store",
    },
  });
}
