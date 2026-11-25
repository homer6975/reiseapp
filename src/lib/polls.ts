// Abstimmungen (SPEC §6.6, ZE-04/ZE-05): Ranking und Hilfsfunktionen.

export type VoteValue = -1 | 1;

export type PollVote = { personId: string; value: VoteValue };

export type PollOptionInput = {
  id: string;
  label: string;
  position: number;
  votes: readonly PollVote[];
};

export type RankedOption = PollOptionInput & {
  up: number;
  down: number;
  balance: number;
  rank: number;
};

/**
 * Ranking: Saldo absteigend, bei Gleichstand mehr 👍, dann frühere Option.
 * Gleichplatzierte (gleicher Saldo und gleich viele 👍) teilen sich den Rang.
 */
export function rankOptions(
  options: readonly PollOptionInput[],
): RankedOption[] {
  const scored = options.map((o) => {
    const up = o.votes.filter((v) => v.value === 1).length;
    const down = o.votes.filter((v) => v.value === -1).length;
    return { ...o, up, down, balance: up - down, rank: 0 };
  });
  scored.sort(
    (a, b) => b.balance - a.balance || b.up - a.up || a.position - b.position,
  );
  scored.forEach((o, i) => {
    const prev = scored[i - 1];
    o.rank =
      prev && prev.balance === o.balance && prev.up === o.up
        ? prev.rank
        : i + 1;
  });
  return scored;
}

/** Nächster Wert beim Tippen auf 👍/👎: gleicher Daumen nochmal nimmt die Stimme zurück. */
export function nextVote(
  current: VoteValue | null,
  pressed: VoteValue,
): VoteValue | null {
  return current === pressed ? null : pressed;
}

export function isExpired(
  poll: { status: string; deadline: string | null },
  now: Date,
): boolean {
  return (
    poll.status === "open" &&
    poll.deadline !== null &&
    Date.parse(poll.deadline) < now.getTime()
  );
}
