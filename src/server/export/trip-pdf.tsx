import "server-only";

import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { detailText, timeText } from "@/components/reisen/plan/item-text";
import { addDays, eachDay } from "@/lib/dates";
import { formatDate, formatDateRange } from "@/lib/format";
import { EXPENSE_CATEGORIES, formatEuro, type summarize } from "@/lib/money";
import { TRIP_MODES } from "@/lib/planner-labels";
import { ITEM_KINDS, TRIP_STATUS } from "@/lib/trip-labels";
import type { PlanItem, TripDetail } from "@/server/trips/data";

export type TripPdfData = {
  trip: TripDetail;
  members: string[];
  items: PlanItem[];
  /** Nur bei Eltern-Session und „mit Kosten“ (SPEC §6.8). */
  costs: ReturnType<typeof summarize> | null;
};

// Standardschrift Helvetica kennt nur WinAnsi: Pfeile u. Ä. ersetzen, Emojis weglassen.
export function pdfText(s: string): string {
  return s
    .replaceAll("→", "->")
    .replaceAll("←", "<-")
    .replace(/[^\u0000-ÿ–—‘-„•…€]/gu, "");
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica" },
  cover: { marginBottom: 12 },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  h2: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#999",
  },
  muted: { color: "#555" },
  item: { flexDirection: "row", paddingVertical: 3 },
  time: { width: 150, paddingRight: 8, color: "#333" },
  body: { flex: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", paddingVertical: 2 },
});

function itemsOn(items: PlanItem[], day: string) {
  return items.filter((i) => {
    if (!i.day) return false;
    if (i.day === day) return true;
    // Mehrtägige Bänder (Hotel, Campingplatz) am letzten Tag als Abreise zeigen.
    return i.span_days > 1 && addDays(i.day, i.span_days - 1) === day;
  });
}

function contacts(items: PlanItem[]) {
  const seen = new Set<string>();
  return items.flatMap((i) => {
    const phone = typeof i.details.phone === "string" ? i.details.phone : "";
    if (!phone && !i.url) return [];
    const key = `${i.title}|${phone}|${i.url}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ title: i.title, phone, url: i.url }];
  });
}

function TripDoc({ data }: { data: TripPdfData }) {
  const { trip, items, members, costs } = data;
  const days = eachDay({ start: trip.start_date, end: trip.end_date });
  const ideas = items.filter((i) => !i.day);
  const contactList = contacts(items);
  return (
    <Document title={pdfText(trip.title)} language="de-DE">
      <Page size="A4" style={styles.page}>
        <View style={styles.cover}>
          <Text style={styles.h1}>{pdfText(trip.title)}</Text>
          <Text>
            {formatDateRange(trip.start_date, trip.end_date)} ·{" "}
            {TRIP_MODES[trip.mode]} · {TRIP_STATUS[trip.status]}
          </Text>
          {members.length > 0 && (
            <Text style={styles.muted}>
              Dabei: {pdfText(members.join(", "))}
            </Text>
          )}
          {trip.notes && (
            <Text style={styles.muted}>{pdfText(trip.notes)}</Text>
          )}
        </View>

        {days.map((day) => {
          const list = itemsOn(items, day);
          return (
            <View key={day} wrap={list.length > 8}>
              <Text style={styles.h2} minPresenceAhead={40}>
                {formatDate(day)}
              </Text>
              {list.length === 0 ? (
                <Text style={styles.muted}>–</Text>
              ) : (
                list.map((i) => {
                  const detail = detailText(i);
                  return (
                    <View key={i.id} style={styles.item} wrap={false}>
                      <Text style={styles.time}>
                        {pdfText(timeText(i, day) ?? "")}
                      </Text>
                      <View style={styles.body}>
                        <Text>
                          <Text style={styles.bold}>{pdfText(i.title)}</Text>
                          <Text style={styles.muted}>
                            {" "}
                            ({ITEM_KINDS[i.kind]})
                          </Text>
                        </Text>
                        {detail && (
                          <Text style={styles.muted}>{pdfText(detail)}</Text>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          );
        })}

        {ideas.length > 0 && (
          <View>
            <Text style={styles.h2}>Ideen</Text>
            {ideas.map((i) => (
              <Text key={i.id}>• {pdfText(i.title)}</Text>
            ))}
          </View>
        )}

        {contactList.length > 0 && (
          <View wrap={false}>
            <Text style={styles.h2}>Kontakte</Text>
            {contactList.map((c) => (
              <Text key={`${c.title}${c.phone}${c.url}`}>
                {pdfText(c.title)}
                {c.phone && ` · ${pdfText(c.phone)}`}
                {c.url && ` · ${pdfText(c.url)}`}
              </Text>
            ))}
          </View>
        )}

        {costs && (
          <View wrap={false}>
            <Text style={styles.h2}>Kosten</Text>
            {costs.categories
              .filter(
                (c) => c.budget > 0 || c.actual !== 0 || c.plannedOpen > 0,
              )
              .map((c) => (
                <View key={c.category} style={styles.row}>
                  <Text style={{ flex: 3 }}>
                    {EXPENSE_CATEGORIES[c.category]}
                  </Text>
                  <Text style={{ flex: 2, textAlign: "right" }}>
                    Ist {formatEuro(c.actual)}
                  </Text>
                  <Text style={{ flex: 2, textAlign: "right" }}>
                    Budget {formatEuro(c.budget)}
                  </Text>
                </View>
              ))}
            <View style={[styles.row, { fontFamily: "Helvetica-Bold" }]}>
              <Text style={{ flex: 3 }}>Summe</Text>
              <Text style={{ flex: 2, textAlign: "right" }}>
                Ist {formatEuro(costs.totals.actual)}
              </Text>
              <Text style={{ flex: 2, textAlign: "right" }}>
                Budget {formatEuro(costs.totals.budget)}
              </Text>
            </View>
          </View>
        )}

        <Text
          style={[
            styles.muted,
            { position: "absolute", bottom: 20, right: 36, fontSize: 8 },
          ]}
          render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export function renderTripPdf(data: TripPdfData): Promise<Buffer> {
  return renderToBuffer(<TripDoc data={data} />);
}
