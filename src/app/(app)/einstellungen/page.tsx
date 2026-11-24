import type { Metadata } from "next";

export const metadata: Metadata = { title: "Einstellungen" };

export default function Page() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      <p className="text-muted-foreground">Kommt in Meilenstein M1.</p>
    </section>
  );
}
