import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

const ERRORS: Record<string, string> = {
  unbekannt:
    "Diese E-Mail-Adresse gehört zu keiner Person in unserer Familie. Ein Elternteil kann sie in den Einstellungen eintragen.",
  link: "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
};

async function ErrorNotice({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { fehler } = await searchParams;
  const message = typeof fehler === "string" ? ERRORS[fehler] : undefined;
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
    >
      {message}
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Familien-Trips</h1>
        <p className="text-muted-foreground">
          Melde dich mit deiner E-Mail-Adresse an.
        </p>
      </div>
      <Suspense>
        <ErrorNotice searchParams={searchParams} />
      </Suspense>
      <LoginForm />
    </main>
  );
}
