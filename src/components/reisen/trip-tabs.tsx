"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Reiter innerhalb einer Reise.
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
    { href: `/reisen/${tripId}/karte`, label: "Karte" },
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
    <nav
      aria-label="Reise"
      className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1"
    >
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
