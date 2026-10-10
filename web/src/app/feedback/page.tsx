"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface Person {
  userId: string;
  name: string;
  bio?: string;
  role?: string;
  education?: string;
  experienceLevel?: string;
  skills: string[];
  interests: string[];
  collaborationPreferences: string[];
}

interface Round {
  roundId: string;
  status: "open" | "completed";
  people: Person[];
}

interface RoundResponse {
  success: boolean;
  data: { round: Round };
}

const RATING_LABELS: Record<number, string> = {
  1: "Not useful",
  2: "Slightly useful",
  3: "Somewhat useful",
  4: "Useful",
  5: "Very useful",
};

type LoadResult = { round: Round } | { error: string };

// Never throws: returns the round or an error message.
const startRound = async (): Promise<LoadResult> => {
  try {
    const response = await api<RoundResponse>("/feedback/rounds", {
      method: "POST",
      token: getToken() ?? undefined,
    });
    return { round: response.data.round };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to start rating.",
    };
  }
};

function PersonCard({
  person,
  rating,
  onRate,
}: {
  person: Person;
  rating?: number;
  onRate: (rating: number) => void;
}) {
  const details = [person.role, person.education, person.experienceLevel]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 font-bold text-white">
          {person.name.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0">
          <h2 className="font-semibold text-zinc-950">{person.name}</h2>
          {details && <p className="text-sm text-zinc-500">{details}</p>}
          {person.bio && (
            <p className="mt-2 text-sm leading-6 text-zinc-600">{person.bio}</p>
          )}
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        {[
          ["Skills", person.skills],
          ["Interests", person.interests],
          ["Likes to work", person.collaborationPreferences],
        ].map(([label, values]) =>
          (values as string[]).length > 0 ? (
            <div key={label as string} className="flex gap-2">
              <dt className="w-28 shrink-0 text-zinc-400">{label as string}</dt>
              <dd className="text-zinc-700">
                {(values as string[]).join(", ")}
              </dd>
            </div>
          ) : null,
        )}
      </dl>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium text-zinc-900">
          How useful would connecting with {person.name.split(" ")[0]} be?
        </legend>

        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={rating === value}
              title={RATING_LABELS[value]}
              onClick={() => onRate(value)}
              className={`h-11 w-11 rounded-xl border text-sm font-semibold transition ${
                rating === value
                  ? "border-black bg-black text-white"
                  : "border-zinc-200 text-zinc-700 hover:border-zinc-400"
              }`}
            >
              {value}
            </button>
          ))}

          <span className="self-center text-sm text-zinc-500">
            {rating ? RATING_LABELS[rating] : "Not rated yet"}
          </span>
        </div>
      </fieldset>
    </li>
  );
}

export default function FeedbackPage() {
  const [round, setRound] = useState<Round | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    startRound().then((result) => {
      if (cancelled) return;

      if ("round" in result) {
        setRound(result.round);
      } else {
        setMessage(result.error);
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const ratedCount = round
    ? round.people.filter((person) => ratings[person.userId]).length
    : 0;
  const allRated = round !== null && ratedCount === round.people.length;

  const handleSubmit = async () => {
    if (!round || !allRated) return;

    setSubmitting(true);
    setMessage("");

    try {
      await api(`/feedback/rounds/${round.roundId}`, {
        method: "POST",
        token: getToken() ?? undefined,
        body: JSON.stringify({
          ratings: round.people.map((person) => ({
            userId: person.userId,
            rating: ratings[person.userId],
          })),
        }),
      });
      setSubmitted(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save ratings.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 bg-zinc-50 p-6">
        <div className="mx-auto max-w-3xl space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-48 animate-pulse rounded-2xl bg-white shadow-sm"
            />
          ))}
        </div>
      </main>
    );
  }

  if (submitted || !round) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">
            {submitted ? "Thank you!" : "Rating unavailable"}
          </h1>

          <p className="mt-3 text-zinc-600">
            {submitted
              ? "Your ratings were saved. When your situation changes, update your context and you can rate a new set of matches."
              : message}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/context"
              className="rounded-xl bg-black px-5 py-3 font-medium text-white hover:bg-zinc-800"
            >
              Update Context
            </Link>
            <Link
              href="/recommendations"
              className="rounded-xl border border-zinc-200 px-5 py-3 font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Recommendations
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-950">
          Rate your matches
        </h1>

        <p className="mt-3 text-zinc-600">
          Think about your current goal. For each person below, how useful would
          it be to connect with them? Rate from 1 (not useful) to 5 (very
          useful).
        </p>

        <p className="mt-2 text-sm text-zinc-500">
          The list is shuffled and scores are hidden on purpose, so your ratings
          are not influenced by the system. Your ratings help evaluate CONTEXA.
        </p>

        <ul className="mt-8 space-y-4">
          {round.people.map((person) => (
            <PersonCard
              key={person.userId}
              person={person}
              rating={ratings[person.userId]}
              onRate={(value) =>
                setRatings((current) => ({
                  ...current,
                  [person.userId]: value,
                }))
              }
            />
          ))}
        </ul>

        <div className="sticky bottom-0 mt-8 flex flex-col items-center gap-3 border-t border-zinc-200 bg-zinc-50/95 py-4 sm:flex-row sm:justify-between">
          <p className="text-sm text-zinc-600">
            {ratedCount} of {round.people.length} rated
          </p>

          {message && (
            <p role="alert" className="text-sm text-red-600">
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allRated || submitting}
            className="rounded-xl bg-black px-6 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40"
          >
            {submitting ? "Saving..." : "Submit ratings"}
          </button>
        </div>
      </div>
    </main>
  );
}
