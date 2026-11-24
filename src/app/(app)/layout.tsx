import Link from "next/link";
import { CalendarDays, House, Luggage, Settings } from "lucide-react";

// Shell: Navigation. Rollen-Kontext (Eltern/Kinder) folgt in M1.
const nav = [
  { href: "/", label: "Start", icon: House },
  { href: "/jahr", label: "Jahr", icon: CalendarDays },
  { href: "/reisen", label: "Reisen", icon: Luggage },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
] as const;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b px-4 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center">
          <Link href="/" className="text-lg font-semibold">
            Familien-Trips
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
      <nav
        aria-label="Hauptnavigation"
        className="sticky bottom-0 border-t bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid max-w-5xl grid-cols-4">
          {nav.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
