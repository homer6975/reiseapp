import type { Metadata } from "next";

export const metadata: Metadata = { title: "Jahresplaner" };

export default function Page() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Jahresplaner</h1>
      <p className="text-muted-foreground">Kommt in Meilenstein M2.</p>
    </section>
  );
}
