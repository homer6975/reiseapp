import { getMe } from "@/lib/auth";

export default async function DashboardPage() {
  const me = await getMe();
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Hallo {me.displayName}!</h1>
      <p className="text-muted-foreground">
        Hier erscheinen bald die nächste Reise, offene Konflikte und
        Abstimmungen.
      </p>
    </section>
  );
}
