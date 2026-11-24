import type { Metadata } from "next";

export const metadata: Metadata = { title: "Anmelden" };

// Magic-Link-Login folgt in M1 (SPEC §2, §5.2).
export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-2 px-4">
      <h1 className="text-2xl font-semibold">Anmelden</h1>
      <p className="text-muted-foreground">
        Die Anmeldung per Magic Link kommt im nächsten Schritt.
      </p>
    </main>
  );
}
