import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reisen" };

export default function Page() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Reisen</h1>
      <p className="text-muted-foreground">Kommt in Meilenstein M3.</p>
    </section>
  );
}
