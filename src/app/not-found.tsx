import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 px-4 py-10">
      <h1 className="text-2xl font-semibold">Seite nicht gefunden</h1>
      <p className="text-muted-foreground">Diese Seite gibt es nicht.</p>
      <Link href="/" className="underline underline-offset-4">
        Zur Startseite
      </Link>
    </main>
  );
}
