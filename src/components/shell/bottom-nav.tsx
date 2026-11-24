import Link from "next/link";
import { CalendarDays, House, Luggage, Settings } from "lucide-react";

import { getMe } from "@/lib/auth";

const items = [
  { href: "/", label: "Start", icon: House, parentOnly: false },
  { href: "/jahr", label: "Jahr", icon: CalendarDays, parentOnly: false },
  { href: "/reisen", label: "Reisen", icon: Luggage, parentOnly: false },
  {
    href: "/einstellungen",
    label: "Einstellungen",
    icon: Settings,
    parentOnly: true,
  },
] as const;

// Kinder sehen keine Einstellungen (SPEC §2).
export async function BottomNav() {
  const me = await getMe();
  const visible = items.filter((i) => me.isParent || !i.parentOnly);

  return (
    <ul
      className="mx-auto grid max-w-5xl"
      style={{
        gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))`,
      }}
    >
      {visible.map(({ href, label, icon: Icon }) => (
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
  );
}
