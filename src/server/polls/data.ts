import "server-only";

import {
  isExpired,
  rankOptions,
  type RankedOption,
  type VoteValue,
} from "@/lib/polls";
import { optionPayloadSchema } from "@/lib/schemas/poll";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PollView = {
  id: string;
  question: string;
  deadline: string | null;
  status: "open" | "closed";
  decidedOptionId: string | null;
  expired: boolean;
  options: (RankedOption & { planDay: string | null; toPlan: boolean })[];
};

export async function loadPolls(
  supabase: Supabase,
  tripId: string,
  now = new Date(),
): Promise<PollView[]> {
  const { data } = await supabase
    .from("poll")
    .select(
      "id, question, deadline, status, decided_option_id, created_at, poll_option!poll_option_poll_id_fkey(id, label, position, payload, vote(person_id, value))",
    )
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  return (data ?? [])
    .map((p) => {
      const payloads = new Map(
        p.poll_option.map((o) => [
          o.id,
          optionPayloadSchema.safeParse(o.payload).data?.dayItem,
        ]),
      );
      return {
        id: p.id,
        question: p.question,
        deadline: p.deadline,
        status: p.status,
        decidedOptionId: p.decided_option_id,
        expired: isExpired(p, now),
        options: rankOptions(
          p.poll_option.map((o) => ({
            id: o.id,
            label: o.label,
            position: o.position,
            votes: o.vote.map((v) => ({
              personId: v.person_id,
              value: v.value as VoteValue,
            })),
          })),
        ).map((o) => ({
          ...o,
          toPlan: payloads.get(o.id) !== undefined,
          planDay: payloads.get(o.id)?.day ?? null,
        })),
      };
    })
    .sort(
      (a, b) => Number(a.status === "closed") - Number(b.status === "closed"),
    );
}

export type OpenPollSummary = {
  id: string;
  question: string;
  deadline: string | null;
  tripId: string;
  tripTitle: string;
  votedByMe: boolean;
  expired: boolean;
};

/** Offene Abstimmungen des Haushalts für das Dashboard (SPEC §6.6, §7). */
export async function loadOpenPolls(
  supabase: Supabase,
  householdId: string,
  personId: string,
  now = new Date(),
): Promise<OpenPollSummary[]> {
  const { data } = await supabase
    .from("poll")
    .select(
      "id, question, deadline, trip!inner(id, title, household_id), poll_option!poll_option_poll_id_fkey(vote(person_id))",
    )
    .eq("status", "open")
    .eq("trip.household_id", householdId)
    .order("deadline", { ascending: true, nullsFirst: false });
  return (data ?? []).map((p) => ({
    id: p.id,
    question: p.question,
    deadline: p.deadline,
    tripId: p.trip.id,
    tripTitle: p.trip.title,
    votedByMe: p.poll_option.some((o) =>
      o.vote.some((v) => v.person_id === personId),
    ),
    expired: isExpired({ status: "open", deadline: p.deadline }, now),
  }));
}
