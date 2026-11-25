"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Reiter innerhalb einer Reise; die Karte folgt mit M7.
export function TripTabs({
  tripId,
  isParent,
}: {
  tripId: string;
  isParent: boolean;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: `/reisen/${tripId}/plan`, label: "Plan" },
    { href: `/reisen/${tripId}/packliste`, label: "Packliste" },
    { href: `/reisen/${tripId}/abstimmungen`, label: "Abstimmungen" },
    { href: `/reisen/${tripId}/dokumente`, label: "Dokumente" },
    // Kosten nur für Eltern – auch nicht in der Navigation (SPEC §2).
    ...(isParent
      ? [{ href: `/reisen/${tripId}/kosten`, label: "Kosten" }]
      : []),
    { href: `/reisen/${tripId}`, label: "Details" },
  ];
  return (
    <nav aria-label="Reise" className="flex gap-1 overflow-x-auto border-b">
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
