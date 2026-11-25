import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";

import type { Conflict } from "@/lib/conflicts";

export function ConflictList({
  conflicts,
  titles,
  linkEvents = true,
}: {
  conflicts: Conflict[];
  titles?: Record<string, string>;
  linkEvents?: boolean;
}) {
  if (conflicts.length === 0) return null;
  return (
    <ul className="space-y-2">
      {conflicts.map((c, i) => {
        const Icon = c.severity === "error" ? AlertTriangle : Info;
        const text = (
          <>
            {titles?.[c.eventId] && (
              <span className="font-medium">{titles[c.eventId]}: </span>
            )}
            {c.message}
          </>
        );
        return (
          <li
            key={`${c.eventId}-${c.kind}-${i}`}
            className={
              c.severity === "error"
                ? "flex gap-2 rounded-md bg-destructive/10 p-3 text-sm"
                : "flex gap-2 rounded-md bg-muted p-3 text-sm"
            }
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {linkEvents ? (
              <Link
                href={`/jahr/termin/${c.eventId}`}
                className="hover:underline"
              >
                {text}
              </Link>
            ) : (
              <span>{text}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
