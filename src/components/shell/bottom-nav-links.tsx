"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, Luggage, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS = {
  "/": House,
  "/jahr": CalendarDays,
  "/reisen": Luggage,
  "/einstellungen": Settings,
};

export type NavItem = { href: keyof typeof ICONS; label: string };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Client-Teil der unteren Navigation: hebt den aktiven Bereich hervor.
export function BottomNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul
      className="mx-auto grid max-w-5xl"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map(({ href, label }) => {
        const Icon = ICONS[href];
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                aria-hidden
                className="size-5"
                strokeWidth={active ? 2.25 : 1.75}
              />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
