"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ThumbsDown, ThumbsUp, Trophy } from "lucide-react";

import { ActionForm } from "@/components/forms/action-form";
import { Card } from "@/components/ui/card";
import { formatDayShort } from "@/lib/format";
import { nextVote, type VoteValue } from "@/lib/polls";
import { localDate, localTime } from "@/lib/timezone";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { castVote, decidePoll, deletePoll } from "@/server/actions/polls";
import type { PollView } from "@/server/polls/data";

const HOME_TZ = "Europe/Berlin";

const deadlineText = (iso: string) =>
  `${formatDayShort(localDate(iso, HOME_TZ))}, ${localTime(iso, HOME_TZ)}`;

// Abstimmungen einer Reise mit 👍/👎 (ZE-04) und „Entscheiden“ (ZE-05), live per Realtime.
export function PollList({
  tripId,
  polls,
  names,
  meId,
  isParent,
}: {
  tripId: string;
  polls: PollView[];
  names: Record<string, string>;
  meId: string;
  isParent: boolean;
}) {
  useRealtimeRefresh(["poll", "poll_option", "vote"], tripId);

  if (polls.length === 0)
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          Noch keine Abstimmungen.
          {isParent && " Lege unten eine an, z. B. für einen Ausflug."}
        </p>
      </Card>
    );

  return (
    <div className="space-y-4">
      {polls.map((p) => (
        <PollCard
          key={p.id}
          poll={p}
          names={names}
          meId={meId}
          isParent={isParent}
        />
      ))}
    </div>
  );
}

function PollCard({
  poll,
  names,
  meId,
  isParent,
}: {
  poll: PollView;
  names: Record<string, string>;
  meId: string;
  isParent: boolean;
}) {
  const open = poll.status === "open";
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Eigene Stimmen optimistisch: optionId → Wert.
  const initial = Object.fromEntries(
    poll.options.map((o) => [
      o.id,
      o.votes.find((v) => v.personId === meId)?.value ?? null,
    ]),
  ) as Record<string, VoteValue | null>;
  const [mine, setMine] = useOptimistic(
    initial,
    (state, change: { id: string; value: VoteValue | null }) => ({
      ...state,
      [change.id]: change.value,
    }),
  );

  function vote(optionId: string, pressed: VoteValue) {
    const value = nextVote(mine[optionId] ?? null, pressed);
    setError(null);
    startTransition(async () => {
      setMine({ id: optionId, value });
      const result = await castVote(optionId, value);
      if (!result.ok)
        setError(result.message ?? "Abstimmen hat nicht geklappt.");
    });
  }

  return (
    <Card className="space-y-3">
      <section aria-label={poll.question} className="space-y-3">
        <div>
          <h2 className="font-semibold">{poll.question}</h2>
          <p className="text-sm text-muted-foreground">
            {!open
              ? "Entschieden"
              : poll.expired
                ? "Frist abgelaufen – bitte entscheiden"
                : poll.deadline
                  ? `Abstimmen bis ${deadlineText(poll.deadline)}`
                  : "Offen"}
          </p>
        </div>
        <ul className="space-y-2">
          {poll.options.map((o) => {
            const winner = poll.decidedOptionId === o.id;
            const my = mine[o.id] ?? null;
            // Eigene Stimme optimistisch in die Anzeige rechnen.
            const others = o.votes.filter((v) => v.personId !== meId);
            const all = my
              ? [...others, { personId: meId, value: my }]
              : others;
            const up = all.filter((v) => v.value === 1);
            const down = all.filter((v) => v.value === -1);
            const who = (list: typeof all) =>
              list.map((v) => names[v.personId] ?? "?").join(", ");
            return (
              <li
                key={o.id}
                aria-label={o.label}
                className={cn(
                  "rounded-lg border p-3",
                  winner && "border-primary bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {winner && (
                        <Trophy
                          className="mr-1 inline size-4 text-primary"
                          aria-label="Gewinner"
                        />
                      )}
                      {o.label}
                    </p>
                    {o.toPlan && (
                      <p className="text-xs text-muted-foreground">
                        → Plan
                        {o.planDay
                          ? `, ${formatDayShort(o.planDay)}`
                          : ", Ideen-Ablage"}
                      </p>
                    )}
                  </div>
                  <p
                    className="text-sm tabular-nums"
                    aria-label={`Saldo ${up.length - down.length}`}
                  >
                    {up.length - down.length > 0 ? "+" : ""}
                    {up.length - down.length}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <VoteButton
                    pressed={my === 1}
                    disabled={!open}
                    onClick={() => vote(o.id, 1)}
                    label={`👍 für ${o.label}`}
                  >
                    <ThumbsUp className="size-5" aria-hidden />
                    <span className="tabular-nums">{up.length}</span>
                  </VoteButton>
                  <VoteButton
                    pressed={my === -1}
                    disabled={!open}
                    onClick={() => vote(o.id, -1)}
                    label={`👎 für ${o.label}`}
                  >
                    <ThumbsDown className="size-5" aria-hidden />
                    <span className="tabular-nums">{down.length}</span>
                  </VoteButton>
                  {isParent && open && (
                    <ActionForm
                      action={decidePoll}
                      submitLabel="Entscheiden"
                      submitVariant="outline"
                      aria-label={`${o.label} entscheiden`}
                      className="ml-auto"
                    >
                      <input type="hidden" name="option_id" value={o.id} />
                    </ActionForm>
                  )}
                </div>
                {(up.length > 0 || down.length > 0) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {up.length > 0 && `👍 ${who(up)}`}
                    {up.length > 0 && down.length > 0 && " · "}
                    {down.length > 0 && `👎 ${who(down)}`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {isParent && (
          <ActionForm
            action={deletePoll}
            submitLabel="Abstimmung löschen"
            submitVariant="ghost"
            confirm="Abstimmung wirklich löschen?"
            aria-label={`${poll.question} löschen`}
          >
            <input type="hidden" name="id" value={poll.id} />
          </ActionForm>
        )}
      </section>
    </Card>
  );
}

function VoteButton({
  pressed,
  disabled,
  onClick,
  label,
  children,
}: {
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-11 min-w-16 items-center justify-center gap-1.5 rounded-full border px-3 text-sm disabled:opacity-60",
        pressed ? "border-primary bg-primary/10 font-medium" : "bg-card",
      )}
    >
      {children}
    </button>
  );
}
