"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Avatar from "@/components/Avatar";

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
  avatarUrl?: string | null;
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
  index,
  rating,
  onRate,
}: {
  person: Person;
  index: number;
  rating?: number;
  onRate: (rating: number) => void;
}) {
  const details = [person.role, person.education].filter(Boolean).join(", ");
  const firstName = person.name.split(" ")[0];

  return (
    <li
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
      className={`panel animate-rise transition-shadow duration-300 sm:p-7 ${
        rating ? "ring-2 ring-brand/40" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        <Avatar src={person.avatarUrl} name={person.name} />

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl leading-tight font-semibold">
            {person.name}
          </h2>
          {(details || person.experienceLevel) && (
            <p className="mt-0.5 text-sm text-muted">
              {details}
              {person.experienceLevel && (
                <span className="text-faint">
                  {details ? " " : ""}({person.experienceLevel})
                </span>
              )}
            </p>
          )}
          {person.bio && (
            <p className="mt-2 text-sm leading-6 text-muted">{person.bio}</p>
          )}
        </div>

        {rating && (
          <span
            className="flex h-7 w-7 shrink-0 animate-fade items-center justify-center rounded-full bg-brand text-white"
            aria-hidden="true"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
              <path
                d="M3.5 8.5l3 3 6-7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </div>

      <dl className="mt-5 grid gap-2.5 text-sm sm:grid-cols-[8rem_1fr]">
        {[
          ["Skills", person.skills],
          ["Interests", person.interests],
          ["Likes to work", person.collaborationPreferences],
        ].map(([label, values]) =>
          (values as string[]).length > 0 ? (
            <div key={label as string} className="contents">
              <dt className="text-faint">{label as string}</dt>
              <dd className="-mt-1.5 text-ink-soft sm:mt-0">
                {(values as string[]).join(", ")}
              </dd>
            </div>
          ) : null,
        )}
      </dl>

      <fieldset className="mt-6 border-t border-line pt-5">
        <legend className="sr-only">
          How useful would connecting with {firstName} be?
        </legend>
        <p
          aria-hidden="true"
          className="mb-3 text-sm font-medium text-ink-soft"
        >
          How useful would connecting with {firstName} be?
        </p>

        <div className="grid grid-cols-5 gap-1.5 sm:max-w-md">
          {[1, 2, 3, 4, 5].map((value) => {
            const selected = rating === value;
            const filled = rating !== undefined && value <= rating;

            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                aria-label={`${value}: ${RATING_LABELS[value]}`}
                onClick={() => onRate(value)}
                className={`h-12 rounded-xl text-base font-semibold tabular-nums transition-all duration-300 ease-[var(--ease-spring)] active:scale-95 ${
                  selected
                    ? "scale-105 bg-brand text-white shadow-[0_6px_18px_-8px_rgb(51_82_255/0.7)]"
                    : filled
                      ? "bg-brand-soft text-brand-ink"
                      : "bg-sunk text-muted ring-1 ring-line hover:text-ink hover:ring-line-strong"
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs text-faint sm:max-w-md">
          <span>Not useful</span>
          <span
            className={`font-medium transition-colors ${rating ? "text-brand" : ""}`}
            aria-live="polite"
          >
            {rating ? RATING_LABELS[rating] : ""}
          </span>
          <span>Very useful</span>
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
      <main className="page">
        <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
          <div className="skeleton h-12 w-2/3" />
          {[1, 2, 3].map((item) => (
            <div key={item} className="skeleton h-56 rounded-[1.75rem]" />
          ))}
        </div>
      </main>
    );
  }

  if (submitted || !round) {
    return (
      <main className="page flex items-center justify-center">
        <section className="panel w-full max-w-lg animate-rise text-center sm:p-10">
          {submitted && (
            <span
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white"
              aria-hidden="true"
            >
              <svg viewBox="0 0 16 16" className="h-6 w-6" fill="none">
                <path
                  d="M3.5 8.5l3 3 6-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          )}
          <h1 className="font-display text-3xl font-semibold">
            {submitted ? "Ratings saved" : "Rating isn’t available"}
          </h1>

          <p className="mx-auto mt-3 max-w-sm leading-7 text-muted">
            {submitted
              ? "Thank you. When your situation changes, update your context and you can rate a new set of matches."
              : message}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <Link href="/context" className="btn btn-primary">
              Update your context
            </Link>
            <Link href="/recommendations" className="btn btn-quiet">
              See your matches
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const progress = round.people.length
    ? (ratedCount / round.people.length) * 100
    : 0;

  return (
    <main className="page">
      <div className="mx-auto max-w-3xl">
        <header>
          <h1 className="page-title">Rate your matches</h1>
          <p className="page-lede">
            Think about your current goal. For each person, how useful would it
            be to connect with them?
          </p>
          <p className="mt-4 flex gap-2.5 rounded-2xl bg-surface px-4 py-3 text-sm leading-6 text-muted ring-1 ring-line/70">
            <svg
              viewBox="0 0 16 16"
              className="mt-1 h-4 w-4 shrink-0 text-brand"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M2.5 13.5l11-11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            The list is shuffled and scores are hidden on purpose, so your
            ratings aren’t influenced by the system. They’re used to evaluate
            how well Contexa matches people.
          </p>
        </header>

        <ul className="mt-8 space-y-4">
          {round.people.map((person, index) => (
            <PersonCard
              key={person.userId}
              person={person}
              index={index}
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

        <div className="sticky bottom-4 z-20 mt-8">
          <div className="flex flex-col gap-3 rounded-[1.5rem] bg-surface/90 p-3 pl-5 shadow-[var(--shadow-float)] ring-1 ring-line/80 backdrop-blur-xl sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-medium tabular-nums">
                {ratedCount} of {round.people.length} rated
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/70">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-500 ease-[var(--ease-spring)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {message && (
              <p role="alert" className="text-sm text-danger">
                {message}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allRated || submitting}
              className="btn btn-primary py-3 sm:px-7"
            >
              {submitting ? "Saving" : "Submit ratings"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
