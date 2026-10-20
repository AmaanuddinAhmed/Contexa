"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  ConnectionState,
  ConnectionsResponse,
  toStateByUserId,
} from "@/lib/connections";
import MatchCard, { Recommendation } from "@/components/MatchCard";
import ScanPanel from "@/components/ScanPanel";
import Segmented from "@/components/Segmented";
import { useConnectionsChanged } from "@/lib/notifications";

type RecommendationMode = "PROFILE_ONLY" | "CONTEXT_AWARE";
type Matcher = "EXACT" | "SEMANTIC";

const MODE_OPTIONS = [
  {
    value: "CONTEXT_AWARE" as const,
    label: "Context-aware",
    description:
      "Ranked by your profile, what you need right now, and how well you can help each other.",
  },
  {
    value: "PROFILE_ONLY" as const,
    label: "Profile only",
    description:
      "The baseline: ranked by profile similarity alone, ignoring your current context.",
  },
];

const MATCHER_OPTIONS = [
  {
    value: "EXACT" as const,
    label: "Exact terms",
    description: "Terms match only when written the same way.",
  },
  {
    value: "SEMANTIC" as const,
    label: "Semantic",
    description:
      "Terms with the same meaning also match, like React and React.js (shown as ≈).",
  },
];

interface RecommendationResponse {
  success: boolean;
  data: {
    mode: RecommendationMode;
    matcher: Matcher;
    recommendations: Recommendation[];
    count: number;
    limit: number;
  };
}

/** Keep the scan on screen long enough to read as a scan, not a flicker. */
const MIN_SCAN_MS = 1200;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [mode, setMode] = useState<RecommendationMode>("CONTEXT_AWARE");
  const [matcher, setMatcher] = useState<Matcher>("EXACT");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [connectionStates, setConnectionStates] = useState<
    Map<string, ConnectionState>
  >(new Map());
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectErrors, setConnectErrors] = useState<Record<string, string>>(
    {},
  );

  const loadRecommendations = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setMessage("Please log in first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    const started = Date.now();

    try {
      const [response, connections] = await Promise.all([
        api<RecommendationResponse>(
          `/recommendations?limit=10&mode=${mode}&matcher=${matcher}`,
          { token },
        ),
        // Connection states only drive the buttons, so a failure here
        // should not hide the recommendations.
        api<ConnectionsResponse>("/connections", { token }).catch(() => null),
      ]);

      await wait(MIN_SCAN_MS - (Date.now() - started));

      setRecommendations(response.data.recommendations);
      setConnectionStates(
        connections ? toStateByUserId(connections.data) : new Map(),
      );
      setConnectErrors({});
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load recommendations.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode, matcher]);

  // Keeps the Connect buttons current when a request is accepted or declined.
  useConnectionsChanged(() => {
    const token = getToken();

    if (!token) {
      return;
    }

    api<ConnectionsResponse>("/connections", { token })
      .then((connections) =>
        setConnectionStates(toStateByUserId(connections.data)),
      )
      .catch(() => {
        // The next change retries.
      });
  });

  const sendConnectionRequest = async (
    recommendation: Recommendation,
    rank: number,
  ) => {
    const token = getToken();

    if (!token) {
      return;
    }

    setConnectingId(recommendation.userId);
    setConnectErrors((errors) => ({ ...errors, [recommendation.userId]: "" }));

    try {
      await api("/connections", {
        method: "POST",
        token,
        body: JSON.stringify({
          recipientId: recommendation.userId,
          // Recorded for evaluation: which variant showed this person, and where.
          source: { mode, matcher, rank, score: recommendation.score },
        }),
      });

      setConnectionStates((states) =>
        new Map(states).set(recommendation.userId, "outgoing"),
      );
    } catch (error) {
      setConnectErrors((errors) => ({
        ...errors,
        [recommendation.userId]:
          error instanceof Error ? error.message : "Unable to send request.",
      }));
    } finally {
      setConnectingId(null);
    }
  };

  const activeMode =
    MODE_OPTIONS.find((option) => option.value === mode) ?? MODE_OPTIONS[0];
  const activeMatcher =
    MATCHER_OPTIONS.find((option) => option.value === matcher) ??
    MATCHER_OPTIONS[0];

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  return (
    <main className="page">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Your matches</h1>
          <p className="page-lede">
            {activeMode.description} {activeMatcher.description}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          <Segmented
            label="Matching mode"
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
            disabled={loading}
          />
          <Segmented
            label="Term matching"
            options={MATCHER_OPTIONS}
            value={matcher}
            onChange={setMatcher}
            disabled={loading}
          />
        </div>
      </header>

      {loading ? (
        <ScanPanel
          key={`${mode}:${matcher}`}
          contextAware={mode === "CONTEXT_AWARE"}
        />
      ) : message ? (
        <section className="panel mx-auto mt-10 max-w-lg animate-rise text-center">
          <h2 className="text-2xl font-semibold">Matches couldn’t load</h2>
          <p className="mt-3 text-muted">{message}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={loadRecommendations}
              className="btn btn-primary"
            >
              Try again
            </button>
            <Link href="/context" className="btn btn-quiet">
              Update your context
            </Link>
          </div>
        </section>
      ) : recommendations.length === 0 ? (
        <section className="panel mt-10 grid animate-rise items-center gap-6 sm:grid-cols-[auto_1fr] sm:gap-10">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-sunk ring-1 ring-line">
            <span className="h-4 w-4 rounded-full bg-ink" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Nobody to show yet</h2>
            <p className="mt-2 max-w-md text-muted">
              Matches need your profile and an active context, and only people
              with public profiles can appear. Tell Contexa what you’re working
              on and what you need, then scan again.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link href="/context" className="btn btn-primary">
                Set your context
              </Link>
              <Link href="/profile" className="btn btn-quiet">
                Check your profile
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="mt-8 mb-5 flex animate-fade flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink tabular-nums">
                {recommendations.length}
              </span>{" "}
              {recommendations.length === 1 ? "person" : "people"}, best match
              first
            </p>
            <button
              type="button"
              onClick={loadRecommendations}
              className="btn btn-quiet"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1M13.5 2.5v3h-3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Scan again
            </button>
          </div>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
            {recommendations.map((recommendation, index) => (
              <MatchCard
                key={recommendation.userId}
                recommendation={recommendation}
                rank={index + 1}
                featured={index === 0}
                connectionState={
                  connectionStates.get(recommendation.userId) ?? "none"
                }
                busy={connectingId === recommendation.userId}
                error={connectErrors[recommendation.userId]}
                onConnect={() =>
                  sendConnectionRequest(recommendation, index + 1)
                }
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
