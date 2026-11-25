import { Suspense } from "react";
import Link from "next/link";

import { BottomNav } from "@/components/shell/bottom-nav";
import { UserMenu } from "@/components/shell/user-menu";

// Shell: Kopfzeile, Inhalt, untere Navigation. Alles, was die Session liest,
// steht hinter Suspense (Cache Components).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-background/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-primary"
          >
            Familien-Trips
          </Link>
          <Suspense>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-muted-foreground">Lädt …</p>}>
          {children}
        </Suspense>
      </main>
      <nav
        aria-label="Hauptnavigation"
        className="sticky bottom-0 min-h-14 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <Suspense>
          <BottomNav />
        </Suspense>
      </nav>
    </div>
  );
}
