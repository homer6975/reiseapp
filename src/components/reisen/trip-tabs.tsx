"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Reiter innerhalb einer Reise; weitere (Karte, Packliste, …) folgen mit M4–M7.
export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/reisen/${tripId}/plan`, label: "Plan" },
    { href: `/reisen/${tripId}`, label: "Details" },
  ];
  return (
    <nav aria-label="Reise" className="flex gap-1 border-b">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
