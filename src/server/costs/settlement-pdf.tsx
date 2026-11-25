import "server-only";

import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatDate } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUS,
  formatAmount,
  formatEuro,
  HOME_CURRENCY,
} from "@/lib/money";

import type { Settlement } from "./settlement";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica" },
  h1: { fontSize: 16, marginBottom: 2, fontFamily: "Helvetica-Bold" },
  h2: {
    fontSize: 11,
    marginTop: 14,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  muted: { color: "#666" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 3,
  },
  head: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
});

const col = (flex: number, right = false) => ({
  flex,
  ...(right ? styles.right : {}),
});

function SettlementDoc({ s }: { s: Settlement }) {
  return (
    <Document title={`Abrechnung ${s.trip.title}`} language="de-DE">
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Abrechnung: {s.trip.title}</Text>
        <Text style={styles.muted}>{s.subtitle}</Text>

        <Text style={styles.h2}>Soll/Ist je Kategorie</Text>
        <View style={[styles.row, styles.head]}>
          <Text style={col(3)}>Kategorie</Text>
          <Text style={col(2, true)}>Budget</Text>
          <Text style={col(2, true)}>Ist</Text>
          <Text style={col(2, true)}>Geplant offen</Text>
        </View>
        {s.summary.categories.map((c) => (
          <View key={c.category} style={styles.row}>
            <Text style={col(3)}>{EXPENSE_CATEGORIES[c.category]}</Text>
            <Text style={col(2, true)}>{formatEuro(c.budget)}</Text>
            <Text style={col(2, true)}>{formatEuro(c.actual)}</Text>
            <Text style={col(2, true)}>{formatEuro(c.plannedOpen)}</Text>
          </View>
        ))}
        <View style={[styles.row, styles.head]}>
          <Text style={col(3)}>Summe</Text>
          <Text style={col(2, true)}>
            {formatEuro(s.summary.totals.budget)}
          </Text>
          <Text style={col(2, true)}>
            {formatEuro(s.summary.totals.actual)}
          </Text>
          <Text style={col(2, true)}>
            {formatEuro(s.summary.totals.plannedOpen)}
          </Text>
        </View>

        <Text style={styles.h2}>Je Währung und Zahler</Text>
        {s.summary.byCurrency.map((c) => (
          <Text key={c.currency}>
            {formatAmount(c.amount, c.currency)}
            {c.currency !== HOME_CURRENCY ? ` = ${formatEuro(c.home)}` : ""}
          </Text>
        ))}
        {s.summary.byPayer.map((p) => (
          <Text key={p.personId ?? "none"}>
            {s.nameOf(p.personId) || "ohne Zahler"}: {formatEuro(p.home)}
          </Text>
        ))}

        <Text style={styles.h2}>Alle Posten</Text>
        <View style={[styles.row, styles.head]} fixed>
          <Text style={col(2)}>Datum</Text>
          <Text style={col(4)}>Titel</Text>
          <Text style={col(2)}>Kategorie</Text>
          <Text style={col(2)}>Status</Text>
          <Text style={col(3, true)}>Betrag</Text>
          <Text style={col(2, true)}>EUR</Text>
        </View>
        {s.expenses.map((e) => (
          <View key={e.id} style={styles.row} wrap={false}>
            <Text style={col(2)}>{formatDate(e.spent_on)}</Text>
            <Text style={col(4)}>{e.title}</Text>
            <Text style={col(2)}>{EXPENSE_CATEGORIES[e.category]}</Text>
            <Text style={col(2)}>{EXPENSE_STATUS[e.status]}</Text>
            <Text style={col(3, true)}>
              {formatAmount(e.amount, e.currency)}
            </Text>
            <Text style={col(2, true)}>{formatEuro(e.amount_home)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export function renderSettlementPdf(s: Settlement): Promise<Buffer> {
  return renderToBuffer(<SettlementDoc s={s} />);
}
